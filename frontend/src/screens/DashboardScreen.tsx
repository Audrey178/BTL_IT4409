import React from "react";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  MessageSquare,
  Archive,
  Plus,
  HelpCircle,
  Settings,
  Flame,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  Clock,
  MapPin,
  MoreVertical,
  Star,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function DashboardScreen() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="h-screen w-64 fixed left-0 top-0 z-40 flex flex-col bg-surface-container-low border-r border-outline-variant/10">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white">
            <Flame className="fill-current" size={24} />
          </div>
          <div>
            <h2 className="font-bold text-lg text-primary">The Hearth</h2>
            <p className="text-xs text-on-surface-variant/70 font-medium">
              Professional Studio
            </p>
            {user && (
              <span className="block text-xs text-on-surface-variant mt-2">{user.email}</span>
            )}
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavItem
            icon={<LayoutDashboard size={20} />}
            label="Meetings"
            active
          />
          <NavItem icon={<CalendarIcon size={20} />} label="Schedule" />
          <NavItem icon={<MessageSquare size={20} />} label="Messages" />
          <NavItem icon={<Archive size={20} />} label="Archives" />
        </nav>

        <div className="px-6 mb-8 space-y-2">
          <Button
            onClick={() => {}}
            className="w-full h-12 bg-primary text-white rounded-full font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            New Meeting
          </Button>
          <Button
            onClick={() => navigate("/signin")}
            className="w-full h-12 bg-linear-to-r from-primary to-primary-container text-white font-bold rounded-full shadow-lg shadow-primary/20"
          >
            Login
          </Button>
          <Button
            onClick={() => navigate("/signup")}
            className="w-full h-12 bg-linear-to-r from-primary to-primary-container text-white font-bold rounded-full shadow-lg shadow-primary/20"
          >
            Signup
          </Button>
        </div>

        <div className="p-6 space-y-4 border-t border-outline-variant/10">
          <button className="flex items-center gap-4 text-on-surface-variant hover:text-primary transition-colors w-full">
            <HelpCircle size={20} />
            <span className="text-sm font-medium">Support</span>
          </button>
          <button className="flex items-center gap-4 text-on-surface-variant hover:text-primary transition-colors w-full">
            <Settings size={20} />
            <span className="text-sm font-medium">Settings</span>
          </button>
          <button
            onClick={() => {
              logout();
              navigate("/signin");
            }}
            className="flex items-center gap-4 text-error hover:opacity-80 transition-colors w-full pt-2"
          >
            <span className="text-sm font-bold">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1 p-8 lg:p-12 bg-surface">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-2">
            <span className="text-primary font-semibold tracking-widest uppercase text-xs">
              Overview
            </span>
            <h1 className="text-5xl font-extrabold tracking-tighter text-on-surface">
              Meeting Schedule
            </h1>
            <p className="text-on-surface-variant max-w-md text-lg">
              Curate your day, connect with your hearth. Your scheduled studio
              sessions are ready.
            </p>
          </div>
          <Button
            onClick={() => {}}
            className="h-14 px-8 bg-gradient-to-r from-primary to-primary-container text-white rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 group"
          >
            <Plus
              className="group-hover:rotate-90 transition-transform"
              size={20}
            />
            Schedule New Meeting
          </Button>
        </header>

        <div className="grid grid-cols-12 gap-8">
          {/* Left Column: Calendar & Recordings */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm border border-outline-variant/10">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-on-surface">
                  October 2023
                </h3>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-surface-container rounded-full transition-colors">
                    <ChevronLeft size={20} />
                  </button>
                  <button className="p-2 hover:bg-surface-container rounded-full transition-colors">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center mb-4">
                {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
                  <span
                    key={d}
                    className="text-xs font-bold text-on-surface-variant/50"
                  >
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2 text-center">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <button
                    key={day}
                    className={`p-2 rounded-xl text-sm font-medium transition-colors ${
                      day === 2
                        ? "bg-primary text-white font-bold"
                        : "hover:bg-primary-fixed"
                    } ${[4, 9].includes(day) ? "text-primary font-bold" : ""}`}
                  >
                    {day}
                    {[2, 4, 9].includes(day) && (
                      <div
                        className={`w-1 h-1 mx-auto mt-0.5 rounded-full ${day === 2 ? "bg-white" : "bg-primary"}`}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-surface-container-low rounded-3xl p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-on-surface-variant">
                  Recent Recordings
                </h3>
                <button className="text-primary text-sm font-bold hover:underline">
                  View all
                </button>
              </div>
              <div className="group cursor-pointer">
                <div className="relative rounded-2xl overflow-hidden mb-4 aspect-video">
                  <img
                    src="https://picsum.photos/seed/room/800/450"
                    alt="Recording"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <PlayCircle className="text-white" size={48} />
                  </div>
                  <span className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg backdrop-blur-md font-bold">
                    45:12
                  </span>
                </div>
                <h4 className="font-bold text-on-surface">Weekly Brand Sync</h4>
                <p className="text-xs text-on-surface-variant/60">
                  Oct 2, 2023
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Meetings */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-on-surface">
                Upcoming Meetings
              </h2>
              <div className="flex gap-2">
                <Badge className="bg-secondary-container text-on-secondary-container hover:bg-secondary-container px-4 py-1.5 rounded-full text-xs font-bold">
                  Today
                </Badge>
                <Badge
                  variant="outline"
                  className="text-on-surface-variant/60 border-outline-variant/20 px-4 py-1.5 rounded-full text-xs font-bold"
                >
                  This Week
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              <MeetingCard
                date="02"
                month="Oct"
                title="Product Sync & Design Review"
                time="10:00 AM - 11:30 AM"
                location="Studio A"
                participants={4}
                onJoin={() => {}}
                active
              />
              <MeetingCard
                date="04"
                month="Oct"
                title="Q4 Strategy Brainstorm"
                time="2:00 PM - 3:30 PM"
                location="Digital Hearth 1"
                participants={12}
                onJoin={() => {}}
              />
              <MeetingCard
                date="09"
                month="Oct"
                title="Project 'Phoenix' Kickoff"
                time="09:00 AM - 10:00 AM"
                location="Main Hall"
                participants={2}
                onJoin={() => {}}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              <div className="bg-gradient-to-br from-primary to-primary-container p-8 rounded-3xl text-white flex flex-col justify-between aspect-square md:aspect-auto">
                <LayoutDashboard size={32} />
                <div>
                  <h3 className="text-2xl font-bold">Total Meeting Time</h3>
                  <p className="text-white/70 text-sm mt-1">
                    This month you've spent 24 hours in focused sessions.
                  </p>
                </div>
              </div>
              <div className="bg-surface-container-high p-8 rounded-3xl flex flex-col justify-between aspect-square md:aspect-auto">
                <div className="flex justify-between items-start">
                  <Star className="text-primary fill-current" size={32} />
                  <span className="text-on-surface-variant/40 font-bold text-[10px] tracking-widest">
                    GOAL MET
                  </span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-on-surface">
                    98% Satisfaction
                  </h3>
                  <p className="text-on-surface-variant text-sm mt-1">
                    Your feedback score for last week's workshops was
                    exceptional.
                  </p>
                </div>
              </div>
              <div className="bg-primary-fixed p-8 rounded-3xl flex flex-col justify-between aspect-square md:aspect-auto">
                <Bot className="text-primary" size={32} />
                <div>
                  <h3 className="text-2xl font-bold text-on-primary-fixed">
                    New Hearth AI Beta
                  </h3>
                  <p className="text-on-primary-fixed-variant text-sm mt-1">
                    Automated summaries are now available for your recordings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`flex items-center gap-4 w-full py-3 px-6 rounded-r-full transition-all duration-200 group ${
        active
          ? "bg-background text-primary font-bold shadow-sm"
          : "text-on-surface-variant hover:bg-white/50 hover:translate-x-1"
      }`}
    >
      <span
        className={`${active ? "text-primary" : "text-on-surface-variant group-hover:text-primary"}`}
      >
        {icon}
      </span>
      <span className="text-sm">{label}</span>
    </button>
  );
}

function MeetingCard({
  date,
  month,
  title,
  time,
  location,
  participants,
  onJoin,
  active = false,
}: any) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-transparent hover:border-outline-variant/20 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all"
    >
      <div className="flex items-start gap-6">
        <div
          className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 ${
            active
              ? "bg-primary-fixed text-on-primary-fixed"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-tighter">
            {month}
          </span>
          <span className="text-2xl font-extrabold">{date}</span>
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-on-surface">{title}</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-on-surface-variant/70 text-sm">
            <span className="flex items-center gap-1.5">
              <Clock size={14} /> {time}
            </span>
            <span className="w-1 h-1 bg-outline-variant rounded-full hidden sm:block" />
            <span className="flex items-center gap-1.5">
              <MapPin size={14} /> {location}
            </span>
          </div>
          <div className="flex items-center -space-x-2 mt-4">
            {[1, 2, 3].map((i) => (
              <Avatar
                key={i}
                className="w-8 h-8 border-2 border-surface-container-lowest"
              >
                <AvatarImage src={`https://i.pravatar.cc/100?u=${i + date}`} />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            ))}
            <div className="w-8 h-8 rounded-full border-2 border-surface-container-lowest bg-surface-container flex items-center justify-center text-[10px] font-bold text-on-surface-variant">
              +{participants}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-on-surface-variant"
        >
          <MoreVertical size={20} />
        </Button>
        <Button
          onClick={onJoin}
          className={`px-10 h-12 rounded-full font-bold transition-all active:scale-95 ${
            active
              ? "bg-primary text-white hover:shadow-lg shadow-primary/20"
              : "variant-outline text-primary border-outline-variant/40"
          }`}
        >
          Join
        </Button>
      </div>
    </motion.div>
  );
}
