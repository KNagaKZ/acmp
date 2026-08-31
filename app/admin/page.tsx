import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminPanel } from "@/components/AdminPanel";
export default async function AdminPage(){const session=await getSession();if(!session)redirect("/login");if(session.mustChangePassword)redirect("/set-password");if(!session.isSuperAdmin)redirect("/dashboard");return <AdminPanel adminName={`${session.name} ${session.surname}`} />;}
