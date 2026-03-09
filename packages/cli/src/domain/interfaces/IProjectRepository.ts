export default interface IProjectRepository {
  find(id: string): Promise<{ id: string; name: string } | null>
  upsert(id: string, name: string): Promise<{ id: string; name: string }>
}
