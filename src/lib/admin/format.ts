export type Person = { first_name: string; last_name: string; email: string | null } | null;
export const personName = (p: Person) => (p ? `${p.first_name} ${p.last_name}`.trim() || p.email || "Student" : "Deleted user");
