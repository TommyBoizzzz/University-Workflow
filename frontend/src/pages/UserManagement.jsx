import { useCallback, useEffect, useState } from 'react'
import {
  createManagedUser,
  createManagedRole,
  deleteManagedUser,
  deleteManagedRole,
  getUserManagementData,
  getManagedRoles,
  getRolePermissionData,
  saveRolePermissions,
  updateManagedRole,
  updateManagedUser,
} from '../services/userService.js'

const emptyForm = {
  fullName: '',
  email: '',
  password: '',
  role: '',
  departmentId: '',
  status: 'ACTIVE',
}
const emptyRoleForm = { name: '', description: '' }

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function UserManagement({ currentUser }) {
  const [directory, setDirectory] = useState({ users: [], roles: [], departments: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState(null)
  const [activeTab, setActiveTab] = useState('users')
  const [permissionRoles, setPermissionRoles] = useState([])
  const [selectedRole, setSelectedRole] = useState('')
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(false)
  const [isPermissionsSaving, setIsPermissionsSaving] = useState(false)
  const [managedRoles, setManagedRoles] = useState([])
  const [isRolesLoading, setIsRolesLoading] = useState(false)
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [roleForm, setRoleForm] = useState(emptyRoleForm)
  const [isRoleSaving, setIsRoleSaving] = useState(false)
  const [deletingRoleId, setDeletingRoleId] = useState(null)
  const [userSearch, setUserSearch] = useState('')
  const [notice, setNotice] = useState('')

  const fetchDirectory = useCallback(() => getUserManagementData(), [])
  const canEditRolePermissions = ['ADMIN', 'SUPERADMIN'].includes(currentUser.role)
  const canManageRoles = canEditRolePermissions

  const refreshUsers = useCallback(async () => {
    setError('')
    setIsLoading(true)
    try {
      setDirectory(await fetchDirectory())
    } catch (loadError) {
      setError(loadError.message || 'Unable to load users.')
    } finally {
      setIsLoading(false)
    }
  }, [fetchDirectory])

  useEffect(() => {
    let isActive = true
    fetchDirectory()
      .then((data) => {
        if (isActive) setDirectory(data)
      })
      .catch((loadError) => {
        if (isActive) setError(loadError.message || 'Unable to load users.')
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [fetchDirectory])

  const openCreateDialog = () => {
    setEditingUser(null)
    setForm({ ...emptyForm, role: directory.roles[0]?.name || '' })
    setError('')
    setNotice('')
    setIsDialogOpen(true)
  }

  const openEditDialog = (managedUser) => {
    setEditingUser(managedUser)
    setForm({
      fullName: managedUser.fullName,
      email: managedUser.email,
      password: '',
      role: managedUser.role,
      departmentId: String(
        directory.departments.find((department) => department.name === managedUser.department)?.id || '',
      ),
      status: managedUser.status,
    })
    setError('')
    setNotice('')
    setIsDialogOpen(true)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)
    const userData = {
      ...form,
      departmentId: form.departmentId || null,
    }

    try {
      if (editingUser) {
        if (!userData.password) delete userData.password
        await updateManagedUser(editingUser.id, userData)
      } else {
        delete userData.status
        await createManagedUser(userData)
      }
      setIsDialogOpen(false)
      setNotice(editingUser ? 'Account changes saved.' : 'Account created successfully.')
      await refreshUsers()
    } catch (saveError) {
      setError(saveError.message || `Unable to ${editingUser ? 'update' : 'create'} user.`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (managedUser) => {
    if (!window.confirm(`Permanently delete ${managedUser.fullName}?`)) return

    setError('')
    setNotice('')
    setDeletingUserId(managedUser.id)
    try {
      await deleteManagedUser(managedUser.id)
      setNotice('Account deleted successfully.')
      await refreshUsers()
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete user.')
    } finally {
      setDeletingUserId(null)
    }
  }

  const closeDialog = () => {
    if (!isSaving) setIsDialogOpen(false)
  }

  const loadRolePermissions = async () => {
    setError('')
    setIsPermissionsLoading(true)
    try {
      const data = await getRolePermissionData()
      setPermissionRoles(data.roles)
      setSelectedRole((previous) => data.roles.some((role) => role.name === previous)
        ? previous
        : data.roles[0]?.name || '')
    } catch (loadError) {
      setError(loadError.message || 'Unable to load role permissions.')
    } finally {
      setIsPermissionsLoading(false)
    }
  }

  const loadManagedRoles = async () => {
    setError('')
    setIsRolesLoading(true)
    try {
      const data = await getManagedRoles()
      setManagedRoles(data.roles)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load roles.')
    } finally {
      setIsRolesLoading(false)
    }
  }

  const openRoleDialog = (role = null) => {
    setEditingRole(role)
    setRoleForm(role
      ? { name: role.name, description: role.description || '' }
      : emptyRoleForm)
    setError('')
    setNotice('')
    setIsRoleDialogOpen(true)
  }

  const handleSaveRole = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsRoleSaving(true)
    try {
      if (editingRole) {
        await updateManagedRole(editingRole.id, roleForm)
      } else {
        await createManagedRole(roleForm)
      }
      setIsRoleDialogOpen(false)
      setNotice(editingRole ? 'Role changes saved.' : 'Role created successfully.')
      await loadManagedRoles()
      await refreshUsers()
      if (permissionRoles.length > 0) await loadRolePermissions()
    } catch (saveError) {
      setError(saveError.message || `Unable to ${editingRole ? 'update' : 'create'} role.`)
    } finally {
      setIsRoleSaving(false)
    }
  }

  const handleDeleteRole = async (role) => {
    if (!window.confirm(`Delete the ${role.name} role?`)) return

    setError('')
    setNotice('')
    setDeletingRoleId(role.id)
    try {
      await deleteManagedRole(role.id)
      setNotice('Role deleted successfully.')
      await loadManagedRoles()
      await refreshUsers()
      await loadRolePermissions()
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete role.')
    } finally {
      setDeletingRoleId(null)
    }
  }

  const handleSaveRolePermissions = async () => {
    const role = permissionRoles.find((item) => item.name === selectedRole)
    if (!role) return

    setError('')
    setNotice('')
    setIsPermissionsSaving(true)
    try {
      await saveRolePermissions(role.name, role.permissions)
      await loadRolePermissions()
      setNotice('Permissions saved. Access changes are checked against the live permissions on the next request.')
    } catch (saveError) {
      setError(saveError.message || 'Unable to save role permissions.')
    } finally {
      setIsPermissionsSaving(false)
    }
  }

  const setPermission = (resource, action, enabled) => {
    setPermissionRoles((roles) => roles.map((role) => role.name === selectedRole
      ? {
          ...role,
          permissions: {
            ...role.permissions,
            [resource]: { ...role.permissions[resource], [action]: enabled },
          },
        }
      : role))
  }

  const canCreateUsers = currentUser.permissions?.users?.create === true
  const canUpdateUsers = currentUser.permissions?.users?.update === true
  const canDeleteUsers = currentUser.permissions?.users?.delete === true
  const selectedPermissionRole = permissionRoles.find((role) => role.name === selectedRole)
  const filteredUsers = directory.users.filter((managedUser) => (
    `${managedUser.fullName} ${managedUser.email} ${managedUser.role} ${managedUser.department || ''} ${managedUser.status}`
      .toLowerCase()
      .includes(userSearch.trim().toLowerCase())
  ))
  const switchTab = (tab) => {
    setActiveTab(tab)
    if (tab === 'permissions' && permissionRoles.length === 0) loadRolePermissions()
    if (tab === 'roles' && managedRoles.length === 0) loadManagedRoles()
  }

  return (
    <>
      <div className="access-management">
        <header className="access-management-header">
          <div className="access-heading-copy">
            <p className="access-eyebrow">ADMINISTRATION / ACCESS CONTROL</p>
            <h2>Users &amp; roles</h2>
            <p>Manage university accounts and control what each role can access.</p>
          </div>
          <div className="access-summary" aria-label="Workspace access summary">
            <div><strong>{isLoading ? '—' : directory.users.length}</strong><span>Accounts</span></div>
            <div><strong>{canManageRoles ? (managedRoles.length || directory.roles.length) : directory.roles.length}</strong><span>Roles</span></div>
            <div><strong>05</strong><span>Modules</span></div>
          </div>
        </header>

        <div className="access-tabs" role="tablist" aria-label="User management sections">
        <button
          id="management-tab-users"
          className={`access-tab ${activeTab === 'users' ? 'active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'users'}
          aria-controls="management-panel-users"
          onClick={() => switchTab('users')}
        >
          <span className="access-tab-index">01</span>
          <span>User accounts</span>
        </button>
        {canManageRoles && (
          <button
            id="management-tab-roles"
            className={`access-tab ${activeTab === 'roles' ? 'active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'roles'}
            aria-controls="management-panel-roles"
            onClick={() => switchTab('roles')}
          >
            <span className="access-tab-index">02</span>
            <span>Role management</span>
          </button>
        )}
        {canEditRolePermissions && (
          <button
            id="management-tab-permissions"
            className={`access-tab ${activeTab === 'permissions' ? 'active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'permissions'}
            aria-controls="management-panel-permissions"
            onClick={() => switchTab('permissions')}
          >
            <span className="access-tab-index">03</span>
            <span>Role permissions</span>
          </button>
        )}
        </div>

        {error && !isDialogOpen && !isRoleDialogOpen && (
          <div className="workspace-error access-feedback" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button>
          </div>
        )}
        {notice && (
          <div className="workspace-success access-feedback" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">×</button>
          </div>
        )}

        {activeTab === 'roles' && canManageRoles ? (
          <section className="access-card" role="tabpanel" id="management-panel-roles" aria-labelledby="management-tab-roles">
            <div className="access-card-heading">
              <div><p className="access-section-kicker">DEFINE ACCESS</p><h3>Role management</h3><p>Create custom roles for specific responsibilities.</p></div>
              <div className="access-card-actions">
                <button className="access-icon-button" type="button" onClick={loadManagedRoles} aria-label="Refresh roles" disabled={isRolesLoading}>↻</button>
                <button className="primary-action" type="button" onClick={() => openRoleDialog()}><span aria-hidden="true">+</span> Create role</button>
              </div>
            </div>
            {isRolesLoading ? (
              <div className="access-loading"><span className="small-spinner" /> Loading roles...</div>
            ) : managedRoles.length === 0 ? (
              <div className="access-empty"><span className="access-empty-icon">◇</span><strong>No roles found</strong><span>Roles you can manage will appear here.</span></div>
            ) : (
              <div className="role-card-grid">
                {managedRoles.map((role) => (
                  <article className="role-card" key={role.id}>
                    <div className="role-card-heading">
                      <span className="role-card-icon" aria-hidden="true">◇</span>
                      <div><h4>{role.name}</h4><span className={`role-kind ${role.isSystem ? 'role-kind-system' : ''}`}>{role.isSystem ? 'Built-in role' : 'Custom role'}</span></div>
                    </div>
                    <p className="role-card-description">{role.description || 'No description has been added.'}</p>
                    <div className="role-card-footer">
                      <span className="role-assignment-count"><strong>{role.userCount}</strong> {role.userCount === 1 ? 'account' : 'accounts'}</span>
                      {role.isSystem ? (
                        <span className="role-protected">Protected</span>
                      ) : (
                        <div className="access-row-actions">
                          <button className="access-edit-button" type="button" onClick={() => openRoleDialog(role)}>Edit</button>
                          <button
                            className="access-delete-button"
                            type="button"
                            disabled={deletingRoleId === role.id || role.userCount > 0}
                            title={role.userCount > 0 ? 'Reassign accounts before deleting this role.' : 'Delete role'}
                            onClick={() => handleDeleteRole(role)}
                          >
                            {deletingRoleId === role.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </div>
                    {!role.isSystem && role.userCount > 0 && <span className="role-card-hint">Reassign accounts before deleting this role.</span>}
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : activeTab === 'permissions' && canEditRolePermissions ? (
          <section className="access-card" role="tabpanel" id="management-panel-permissions" aria-labelledby="management-tab-permissions">
            <div className="access-card-heading">
              <div><p className="access-section-kicker">POLICY BUILDER</p><h3>Role permissions</h3><p>Choose which actions each role is allowed to perform.</p></div>
              <button className="access-icon-button" type="button" onClick={loadRolePermissions} aria-label="Refresh role permissions" disabled={isPermissionsLoading}>↻</button>
            </div>
            {isPermissionsLoading ? (
              <div className="access-loading"><span className="small-spinner" /> Loading role permissions...</div>
            ) : permissionRoles.length === 0 ? (
              <div className="access-empty"><span className="access-empty-icon">⌑</span><strong>No roles available</strong><span>There are no roles available for permission management.</span></div>
            ) : (
              <>
                <div className="permission-layout">
                  <aside className="permission-role-list" aria-label="Select a role">
                    <p className="permission-role-list-title">SELECT ROLE</p>
                    {permissionRoles.map((role) => (
                      <button
                        className={`permission-role-choice ${selectedRole === role.name ? 'active' : ''}`}
                        type="button"
                        key={role.name}
                        aria-pressed={selectedRole === role.name}
                        onClick={() => setSelectedRole(role.name)}
                      >
                        <span className="permission-role-mark">{role.name.slice(0, 1)}</span>
                        <span>{role.name}</span>
                        <span className="permission-role-arrow" aria-hidden="true">›</span>
                      </button>
                    ))}
                  </aside>
                  <div className="permission-editor">
                    {selectedPermissionRole && (
                      <>
                        <div className="permission-editor-heading">
                          <div>
                            <span className="permission-editor-label">EDITING PERMISSIONS FOR</span>
                            <h4>{selectedPermissionRole.name}</h4>
                            {selectedRole === 'SUPERADMIN'
                              ? <p>Super Admin access is fixed to retain full system control.</p>
                              : <p>Changes are checked against the live permissions on the next request.</p>}
                          </div>
                          <button
                            className="primary-action"
                            type="button"
                            onClick={handleSaveRolePermissions}
                            disabled={isPermissionsSaving || selectedRole === 'SUPERADMIN'}
                          >
                            {isPermissionsSaving ? 'Saving...' : 'Save permissions'}
                          </button>
                        </div>
                        <div className="permission-implementation-note">
                          Request review requires Requests: Update plus Approvals: Create and Update. Documents and Calendar do not have data APIs yet, and Request/Approval delete actions are not connected; those saved settings cannot perform operations until their APIs exist.
                        </div>
                        <div className="permission-card-grid">
                          {Object.entries(selectedPermissionRole.permissions).map(([resource, actions]) => (
                            <section className="permission-card" key={resource} aria-labelledby={`permission-resource-${resource}`}>
                              <div className="permission-card-heading">
                                <span className="permission-resource-mark" aria-hidden="true">{resource.slice(0, 1).toUpperCase()}</span>
                                <div><h5 id={`permission-resource-${resource}`}>{resource}</h5><span>Access controls</span></div>
                              </div>
                              <div className="permission-toggle-list">
                                {Object.entries(actions).map(([action, enabled]) => (
                                  <label className="permission-toggle-row" key={action}>
                                    <span>{action[0].toUpperCase() + action.slice(1)}</span>
                                    <span className="permission-switch">
                                      <input
                                        type="checkbox"
                                        checked={enabled}
                                        disabled={selectedRole === 'SUPERADMIN'}
                                        onChange={(event) => setPermission(resource, action, event.target.checked)}
                                      />
                                      <span className="permission-switch-track" aria-hidden="true" />
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </section>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="access-card" role="tabpanel" id="management-panel-users" aria-labelledby="management-tab-users">
            <div className="access-card-heading">
              <div><p className="access-section-kicker">UNIVERSITY DIRECTORY</p><h3>User accounts</h3><p>{currentUser.role === 'ADMIN' ? 'Admins can manage Manager, Teacher, and custom-role accounts.' : 'Create accounts, assign roles, and manage account access.'}</p></div>
              <div className="access-card-actions">
                <button className="access-icon-button" type="button" onClick={refreshUsers} aria-label="Refresh users" disabled={isLoading}>↻</button>
                {canCreateUsers && <button className="primary-action" type="button" onClick={openCreateDialog}><span aria-hidden="true">+</span> Add account</button>}
              </div>
            </div>
            <div className="user-directory-toolbar">
              <label className="user-search" htmlFor="user-search">
                <span aria-hidden="true">⌕</span>
                <input id="user-search" type="search" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search name, email, role..." />
              </label>
              <span className="user-result-count">{isLoading ? 'Loading accounts...' : `${filteredUsers.length} ${filteredUsers.length === 1 ? 'account' : 'accounts'}`}</span>
            </div>
            {isLoading ? (
              <div className="access-loading"><span className="small-spinner" /> Loading user accounts...</div>
            ) : directory.users.length === 0 ? (
              <div className="access-empty"><span className="access-empty-icon">♙</span><strong>No user accounts yet</strong><span>Create an account to give a university member access.</span></div>
            ) : filteredUsers.length === 0 ? (
              <div className="access-empty"><span className="access-empty-icon">⌕</span><strong>No matching accounts</strong><span>Try a different name, email, role, or status.</span></div>
            ) : (
              <div className="access-table-wrap">
                <table className="access-user-table">
                  <thead><tr><th>Account</th><th>Role</th><th>Department</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {filteredUsers.map((managedUser) => {
                      const isAdminRestricted = currentUser.role === 'ADMIN'
                        && !directory.roles.some((role) => role.name === managedUser.role)
                      const isCurrentUser = Number(currentUser.id) === Number(managedUser.id)
                      return (
                        <tr key={managedUser.id}>
                          <td>
                            <div className="account-cell">
                              <span className="account-avatar">{getInitials(managedUser.fullName)}</span>
                              <span className="account-copy"><strong>{managedUser.fullName}</strong><span>{managedUser.email}</span></span>
                            </div>
                          </td>
                          <td><span className="access-role-badge">{managedUser.role}</span></td>
                          <td>{managedUser.department || <span className="muted-value">Not assigned</span>}</td>
                          <td><span className={`access-status access-status-${managedUser.status.toLowerCase()}`}><i />{managedUser.status}</span></td>
                          <td>
                            <div className="access-row-actions">
                              {canUpdateUsers && <button className="access-edit-button" type="button" disabled={isAdminRestricted} onClick={() => openEditDialog(managedUser)}>Edit</button>}
                              {canDeleteUsers && <button className="access-delete-button" type="button" disabled={deletingUserId === managedUser.id || isCurrentUser || isAdminRestricted} onClick={() => handleDelete(managedUser)}>{deletingUserId === managedUser.id ? 'Deleting...' : 'Delete'}</button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {isRoleDialogOpen && activeTab === 'roles' && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isRoleSaving) setIsRoleDialogOpen(false)
        }}>
          <section className="request-modal role-management-modal" role="dialog" aria-modal="true" aria-labelledby="role-dialog-title">
            <div className="modal-heading">
              <div>
                <p className="page-eyebrow">ROLE MANAGEMENT</p>
                <h2 id="role-dialog-title">{editingRole ? 'Edit role' : 'Create role'}</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => !isRoleSaving && setIsRoleDialogOpen(false)}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSaveRole}>
              <label htmlFor="managed-role-name">Role name</label>
              <input
                id="managed-role-name"
                maxLength="50"
                pattern="[A-Za-z][A-Za-z0-9_]{1,49}"
                required
                value={roleForm.name}
                onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value.toUpperCase() })}
                placeholder="For example: LIBRARIAN"
              />
              <label htmlFor="managed-role-description">Description <span>(optional)</span></label>
              <textarea
                id="managed-role-description"
                maxLength="500"
                rows="3"
                value={roleForm.description}
                onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
                placeholder="Describe this role's responsibilities"
              />
              {error && isRoleDialogOpen && <div className="form-error" role="alert">{error}</div>}
              <div className="modal-actions">
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => setIsRoleDialogOpen(false)}
                  disabled={isRoleSaving}
                >
                  Cancel
                </button>
                <button className="primary-action" type="submit" disabled={isRoleSaving}>
                  {isRoleSaving ? 'Saving...' : editingRole ? 'Save changes' : 'Create role'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isDialogOpen && activeTab === 'users' && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDialog()
        }}>
          <section className="request-modal user-modal" role="dialog" aria-modal="true" aria-labelledby="managed-user-title">
            <div className="modal-heading">
              <div>
                <p className="page-eyebrow">ACCOUNT MANAGEMENT</p>
                <h2 id="managed-user-title">{editingUser ? 'Edit user' : 'Create user'}</h2>
              </div>
              <button type="button" className="modal-close" onClick={closeDialog} aria-label="Close dialog">×</button>
            </div>
            <form onSubmit={handleSave}>
              <label htmlFor="managed-user-name">Full name</label>
              <input
                id="managed-user-name"
                autoComplete="name"
                maxLength="150"
                required
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                placeholder="Enter the user's full name"
              />

              <label htmlFor="managed-user-email">University email</label>
              <input
                id="managed-user-email"
                autoComplete="email"
                type="email"
                maxLength="150"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="name@university.edu"
              />

              <label htmlFor="managed-user-password">
                {editingUser ? 'New password' : 'Initial password'}
                {editingUser && <span> (optional)</span>}
              </label>
              <input
                id="managed-user-password"
                autoComplete="new-password"
                type="password"
                minLength="12"
                maxLength="72"
                required={!editingUser}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder={editingUser ? 'Leave blank to keep current password' : 'At least 12 characters'}
              />

              <label htmlFor="managed-user-role">Role</label>
              <select
                id="managed-user-role"
                required
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
              >
                {directory.roles.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}
              </select>

              <label htmlFor="managed-user-department">Department <span>(optional)</span></label>
              <select
                id="managed-user-department"
                value={form.departmentId}
                onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
              >
                <option value="">No department</option>
                {directory.departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>

              {editingUser && (
                <>
                  <label htmlFor="managed-user-status">Account status</label>
                  <select
                    id="managed-user-status"
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </>
              )}

              {currentUser.role === 'ADMIN' && (
                <p className="role-policy-note">Only a Super Admin can manage Admin or Super Admin accounts.</p>
              )}
              {error && isDialogOpen && <div className="form-error" role="alert">{error}</div>}
              <div className="modal-actions">
                <button className="secondary-action" type="button" onClick={closeDialog} disabled={isSaving}>Cancel</button>
                <button className="primary-action" type="submit" disabled={isSaving || !form.role}>
                  {isSaving ? 'Saving...' : editingUser ? 'Save changes' : 'Create user'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

export default UserManagement
