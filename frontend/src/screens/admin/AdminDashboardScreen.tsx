import React from "react";
import { motion } from "motion/react";
import {
  ShieldCheck,
  Users,
  CalendarDays,
  Database,
  Activity,
  Search,
  MoreVertical,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const userRows = [
  { name: "Elena Vance", email: "elena@digitalhearth.com", role: "Admin", status: "Active" },
  { name: "Marcus Chen", email: "marcus@digitalhearth.com", role: "Host", status: "Active" },
  { name: "Sarah Jenkins", email: "sarah@digitalhearth.com", role: "Member", status: "Pending" },
  { name: "David Miller", email: "david@digitalhearth.com", role: "Member", status: "Active" },
];

export function AdminDashboardScreen() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="max-w-screen-2xl mx-auto p-8 lg:p-12">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div>
            <p className="text-primary font-semibold uppercase tracking-[0.3em] text-sm">
              Admin Dashboard
            </p>
            <h1 className="mt-4 text-4xl md:text-5xl font-extrabold tracking-tight">
              Manage platform health, users, and meetings.
            </h1>
            <p className="mt-4 max-w-2xl text-on-surface-variant text-base">
              This workspace gives you an overview of the studio platform, user controls,
              and system activity so you can keep everything running smoothly.
            </p>
          </div>
          <Button className="h-14 px-6 bg-primary text-white rounded-full shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform flex items-center gap-2">
            <Plus size={18} /> Create user
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-4 mb-10">
          <StatusCard
            icon={<ShieldCheck size={24} />}
            title="Platform Status"
            value="Healthy"
            variant="bg-emerald-500/10 text-emerald-900"
          />
          <StatusCard
            icon={<Users size={24} />}
            title="Total Users"
            value="1,280"
            variant="bg-primary/10 text-primary"
          />
          <StatusCard
            icon={<CalendarDays size={24} />}
            title="Meetings Today"
            value="18"
            variant="bg-sky-500/10 text-sky-900"
          />
          <StatusCard
            icon={<Database size={24} />}
            title="Pending Approvals"
            value="6"
            variant="bg-amber-500/10 text-amber-900"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-low p-8 shadow-sm"
          >
            <div className="flex items-center justify-between mb-8 gap-4">
              <div>
                <h2 className="text-2xl font-bold">User Management</h2>
                <p className="text-sm text-on-surface-variant">
                  Review account status, roles, and platform access.
                </p>
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant">
                <Search size={18} />
                <MoreVertical size={18} />
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-outline-variant/10 bg-surface-container-highest">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-container-low px-4 py-3 text-on-surface-variant uppercase text-[11px] tracking-[0.2em]">
                  <tr>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {userRows.map((user) => (
                    <tr key={user.email} className="hover:bg-surface/50 transition-colors">
                      <td className="px-6 py-5 font-semibold text-on-surface">
                        {user.name}
                      </td>
                      <td className="px-6 py-5 text-on-surface-variant">
                        {user.email}
                      </td>
                      <td className="px-6 py-5">
                        <Badge className="bg-surface-container-lowest text-on-surface px-3 py-1.5 rounded-full text-xs font-bold">
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          user.status === "Active"
                            ? "bg-emerald-500/10 text-emerald-900"
                            : "bg-amber-500/10 text-amber-900"
                        }`}
                        >
                          {user.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-low p-8 shadow-sm"
          >
            <div className="flex items-center justify-between mb-8 gap-4">
              <div>
                <h2 className="text-2xl font-bold">Recent Activity</h2>
                <p className="text-sm text-on-surface-variant">
                  Track the latest platform events and moderation actions.
                </p>
              </div>
              <Button variant="outline" className="h-12 px-4 rounded-full text-sm">
                View all
              </Button>
            </div>

            <div className="space-y-5">
              <ActivityRow action="New admin user added" detail="Elena Vance • 3m ago" />
              <ActivityRow action="Meeting room created" detail="Marketing review • 12m ago" />
              <ActivityRow action="User request approved" detail="Sarah Jenkins • 22m ago" />
              <ActivityRow action="System backup completed" detail="Database sync • 40m ago" />
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon, title, value, variant }: any) {
  return (
    <div className={`rounded-[2rem] p-6 border border-outline-variant/10 bg-surface-container-highest shadow-sm ${variant}`}>
      <div className="flex items-center justify-between mb-6 text-on-surface-variant">
        <span className="text-sm font-semibold">{title}</span>
        <div className="w-10 h-10 rounded-2xl bg-white/80 flex items-center justify-center text-current">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-on-surface">{value}</p>
    </div>
  );
}

function ActivityRow({ action, detail }: { action: string; detail: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-3xl bg-surface-container-lowest p-4 border border-outline-variant/10">
      <div>
        <p className="font-semibold text-on-surface">{action}</p>
        <p className="text-sm text-on-surface-variant mt-1">{detail}</p>
      </div>
      <Activity size={20} className="text-primary" />
    </div>
  );
}
