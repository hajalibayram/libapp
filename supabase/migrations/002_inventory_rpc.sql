-- Atomic inventory operations for the Volunteer Bookshop MVP.
-- Run this after 001_initial_schema.sql.

create or replace function public.inventory_add(
  p_user_id uuid,
  p_isbn13 text,
  p_isbn10 text,
  p_title text,
  p_subtitle text,
  p_authors text[],
  p_publisher text,
  p_publication_date text,
  p_language text,
  p_description text,
  p_cover_url text,
  p_metadata_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_author_name text;
  v_author_id uuid;
  v_before integer;
  v_after integer;
  v_transaction_id uuid;
begin
  if p_isbn13 is null and p_isbn10 is null then
    raise exception 'An ISBN-13 or ISBN-10 is required';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Title is required';
  end if;

  perform pg_advisory_xact_lock(hashtext(coalesce(p_isbn13, p_isbn10)));

  select id
  into v_book_id
  from public.books
  where (p_isbn13 is not null and isbn13 = p_isbn13)
     or (p_isbn10 is not null and isbn10 = p_isbn10)
  limit 1
  for update;

  if v_book_id is null then
    insert into public.books (
      isbn13,
      isbn10,
      title,
      subtitle,
      publisher,
      publication_date,
      language,
      description,
      cover_url,
      metadata_source
    )
    values (
      p_isbn13,
      p_isbn10,
      p_title,
      p_subtitle,
      p_publisher,
      p_publication_date,
      p_language,
      p_description,
      p_cover_url,
      p_metadata_source
    )
    returning id into v_book_id;

    foreach v_author_name in array coalesce(p_authors, array['Unknown author']::text[])
    loop
      if length(trim(v_author_name)) > 0 then
        insert into public.authors (name)
        values (trim(v_author_name))
        on conflict (name) do update set name = excluded.name
        returning id into v_author_id;

        insert into public.book_authors (book_id, author_id)
        values (v_book_id, v_author_id)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  insert into public.inventory (book_id, quantity)
  values (v_book_id, 0)
  on conflict (book_id) do nothing;

  select quantity
  into v_before
  from public.inventory
  where book_id = v_book_id
  for update;

  update public.inventory
  set quantity = quantity + 1,
      updated_at = now()
  where book_id = v_book_id
  returning quantity into v_after;

  insert into public.inventory_transactions (
    book_id,
    user_id,
    action,
    quantity_delta,
    quantity_before,
    quantity_after
  )
  values (
    v_book_id,
    p_user_id,
    'ADD',
    1,
    v_before,
    v_after
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'status', 'SUCCESS',
    'bookId', v_book_id,
    'transactionId', v_transaction_id,
    'before', v_before,
    'after', v_after
  );
end;
$$;

create or replace function public.inventory_remove(
  p_user_id uuid,
  p_book_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before integer;
  v_after integer;
  v_transaction_id uuid;
begin
  select quantity
  into v_before
  from public.inventory
  where book_id = p_book_id
  for update;

  if v_before is null then
    return jsonb_build_object('status', 'NOT_IN_INVENTORY');
  end if;

  if v_before <= 0 then
    return jsonb_build_object(
      'status', 'OUT_OF_STOCK',
      'bookId', p_book_id,
      'before', 0,
      'after', 0
    );
  end if;

  update public.inventory
  set quantity = quantity - 1,
      updated_at = now()
  where book_id = p_book_id
    and quantity > 0
  returning quantity into v_after;

  if v_after is null then
    return jsonb_build_object(
      'status', 'OUT_OF_STOCK',
      'bookId', p_book_id,
      'before', v_before,
      'after', v_before
    );
  end if;

  insert into public.inventory_transactions (
    book_id,
    user_id,
    action,
    quantity_delta,
    quantity_before,
    quantity_after
  )
  values (
    p_book_id,
    p_user_id,
    'REMOVE',
    -1,
    v_before,
    v_after
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'status', 'SUCCESS',
    'bookId', p_book_id,
    'transactionId', v_transaction_id,
    'before', v_before,
    'after', v_after
  );
end;
$$;

create or replace function public.inventory_undo(
  p_user_id uuid,
  p_transaction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original public.inventory_transactions%rowtype;
  v_before integer;
  v_after integer;
  v_delta integer;
  v_undo_transaction_id uuid;
begin
  select *
  into v_original
  from public.inventory_transactions
  where id = p_transaction_id
  for update;

  if v_original.id is null or v_original.action = 'UNDO' then
    return jsonb_build_object('status', 'CANNOT_UNDO');
  end if;

  if exists (
    select 1
    from public.inventory_transactions
    where reverses_transaction_id = p_transaction_id
  ) then
    return jsonb_build_object('status', 'ALREADY_UNDONE');
  end if;

  select quantity
  into v_before
  from public.inventory
  where book_id = v_original.book_id
  for update;

  if v_before is null then
    return jsonb_build_object('status', 'CANNOT_UNDO');
  end if;

  v_delta := -v_original.quantity_delta;
  v_after := v_before + v_delta;

  if v_after < 0 then
    return jsonb_build_object('status', 'CANNOT_UNDO');
  end if;

  update public.inventory
  set quantity = v_after,
      updated_at = now()
  where book_id = v_original.book_id;

  insert into public.inventory_transactions (
    book_id,
    user_id,
    action,
    quantity_delta,
    quantity_before,
    quantity_after,
    reverses_transaction_id
  )
  values (
    v_original.book_id,
    p_user_id,
    'UNDO',
    v_delta,
    v_before,
    v_after,
    p_transaction_id
  )
  returning id into v_undo_transaction_id;

  return jsonb_build_object(
    'status', 'SUCCESS',
    'bookId', v_original.book_id,
    'transactionId', v_undo_transaction_id,
    'before', v_before,
    'after', v_after
  );
end;
$$;
