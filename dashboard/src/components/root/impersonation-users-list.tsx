interface User {
  id: string
  name: string
  email: string
}

interface Props {
  users: User[]
  onImpersonate: (userId: string) => void
}

export function ImpersonationUsersList({ users, onImpersonate }: Props) {
  return (
    <table data-testid="impersonation-users-list">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Email</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id}>
            <td data-testid={`user-name-${user.id}`}>{user.name || user.email}</td>
            <td>{user.email}</td>
            <td>
              <button
                onClick={() => onImpersonate(user.id)}
                data-testid={`entrar-como-${user.id}`}
              >
                Entrar como
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
