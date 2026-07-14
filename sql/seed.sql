-- Enable pgcrypto for on-the-fly bcrypt password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. INSERT ROLES
INSERT INTO roles (name, description) VALUES
    ('Admin', 'Full system access and user management'),
    ('Operator', 'Can manage data and update tasks'),
    ('Agent', 'Limited data access, updates task progress'),
    ('Agent 2', 'Custom restricted testing role')
ON CONFLICT (name) DO NOTHING;

-- 2. INSERT TEST USERS
-- We use subqueries to fetch the dynamic UUIDs of the roles we just created.
-- The crypt('password', gen_salt('bf')) function generates a Node-compatible bcrypt hash.

-- Admin User
INSERT INTO users (role_id, first_name, last_name, email, password_hash)
SELECT id, 'Super', 'Admin', 'admin@swara.com', crypt('Admin@123', gen_salt('bf'))
FROM roles WHERE name = 'Admin'
ON CONFLICT (email) DO NOTHING;

-- Operator User
INSERT INTO users (role_id, first_name, last_name, email, password_hash)
SELECT id, 'System', 'Operator', 'operator@swara.com', crypt('Operator@123', gen_salt('bf'))
FROM roles WHERE name = 'Operator'
ON CONFLICT (email) DO NOTHING;

-- Agent User
INSERT INTO users (role_id, first_name, last_name, email, password_hash)
SELECT id, 'Field', 'Agent', 'agent@swara.com', crypt('Agent@123', gen_salt('bf'))
FROM roles WHERE name = 'Agent'
ON CONFLICT (email) DO NOTHING;

-- Agent 2 User
INSERT INTO users (role_id, first_name, last_name, email, password_hash)
SELECT id, 'Support', 'Agent', 'agent2@swara.com', crypt('Agent2@123', gen_salt('bf'))
FROM roles WHERE name = 'Agent 2'
ON CONFLICT (email) DO NOTHING;

-- 3. INSERT CORE PERMISSIONS
INSERT INTO permissions (name, module) VALUES
    ('manage_users', 'Users'),
    ('view_users', 'Users'),
    ('manage_tasks', 'Tasks'),
    ('view_tasks', 'Tasks'),
    ('manage_data', 'Data'),
    ('view_data', 'Data'),
    ('manage_links', 'Links'),
    ('view_links', 'Links')
ON CONFLICT (name) DO NOTHING;

-- 4. MAP PERMISSIONS TO ROLES (RBAC SETUP)

-- Admin: Give all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;

-- Operator: Give task, data, and link management permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'Operator' 
  AND p.name IN ('manage_tasks', 'view_tasks', 'manage_data', 'view_data', 'view_links', 'manage_links')
ON CONFLICT DO NOTHING;

-- Agent & Agent 2: Give view-only permissions for tasks and links
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name IN ('Agent', 'Agent 2') 
  AND p.name IN ('view_tasks', 'view_links')
ON CONFLICT DO NOTHING;