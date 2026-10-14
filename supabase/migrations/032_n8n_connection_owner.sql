-- A connection can belong to one client: the client runs its own n8n and gave
-- us an API key so promoting a version pushes the prompt there too.
--
-- client_id null = a Zebra connection, offered to every client. Set = that
-- client's own instance, offered only to that client, so another client's
-- prompt can never be pushed into it. Deleting the client deletes its key.
alter table n8n_connections
  add column client_id uuid references clients(id) on delete cascade;

create index idx_n8n_connections_client on n8n_connections (client_id);

-- Templates are duplicated for new Zebra clients, so they only live on a Zebra
-- connection. One on a client's instance would make new clients copy from it.
alter table n8n_connections
  add constraint n8n_connections_template_on_shared check (
    client_id is null
    or (template_workflow_id is null and template_workflow_id_ghl is null)
  );

-- Deleting a client cascades both to its bindings and to its connection. With
-- RESTRICT the check runs mid-cascade and can fire before the bindings are
-- gone; NO ACTION checks at the end of the statement. A connection still in
-- use by another row is refused exactly as before.
alter table n8n_bindings
  drop constraint n8n_bindings_connection_id_fkey,
  add constraint n8n_bindings_connection_id_fkey
    foreign key (connection_id) references n8n_connections(id) on delete no action;
