import AdminDashboard from "./admin-dashboard";

export const metadata = {
  title: "Admin console | ClerkME",
  description: "Private ClerkME platform administration.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return <AdminDashboard />;
}
