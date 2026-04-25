import React, { useState } from "react";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  Star,
  Bot,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router";
import SideBar from "@/components/layout/SideBar";
import MeetingCard from "@/components/pages/dashboard/MeetingCard";
import { CreateRoomDialog } from "@/components/pages/dashboard/room/CreateRoomDialog";
import { JoinRoomDialog } from "@/components/pages/dashboard/room/JoinRoomDialog";
import { ScheduleMeetingDialog } from "@/components/pages/dashboard/room/ScheduleMeetingDialog";
import { useUpcomingMeetings } from "@/hooks/useUpcomingMeetings";
import { useMeetingReminder } from "@/hooks/useMeetingReminder";

export function DashboardScreen() {
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  const { meetings, loading, refetch } = useUpcomingMeetings();
  useMeetingReminder(meetings);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <SideBar
        onNewMeeting={() => setShowCreateDialog(true)}
      />
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
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowJoinDialog(true)}
              className="h-14 px-8 bg-surface-container-highest text-on-surface rounded-full font-bold shadow-sm hover:bg-surface-container-high hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 group border border-outline-variant/20"
            >
              <LogIn
                className="group-hover:translate-x-0.5 transition-transform"
                size={20}
              />
              Join Meeting
            </Button>
            <Button
              onClick={() => setShowScheduleDialog(true)}
              className="h-14 px-8 bg-gradient-to-r from-primary to-primary-container text-white rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 group"
            >
              <Plus
                className="group-hover:rotate-90 transition-transform"
                size={20}
              />
              Schedule New Meeting
            </Button>
          </div>
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
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <span
                    key={`${d}-${i}`}
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
                    className={`p-2 rounded-xl text-sm font-medium transition-colors ${day === 2
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
              {loading ? (
                <div className="text-center py-8 text-on-surface-variant">Loading meetings...</div>
              ) : meetings.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant bg-surface-container-low rounded-3xl border border-dashed border-outline-variant/30">
                  <CalendarIcon size={32} className="mx-auto mb-3 opacity-50" />
                  <p>No upcoming meetings scheduled</p>
                </div>
              ) : (
                meetings.slice(0, 4).map((meeting) => (
                  <MeetingCard
                    key={meeting.room_code}
                    meeting={meeting}
                    onJoin={(code) => navigate(`/lobby?code=${code}`)}
                  />
                ))
              )}
            </div>
            {/* stats */}
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

      {/* Dialogs */}
      <CreateRoomDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
      <ScheduleMeetingDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        onScheduled={refetch}
      />
      <JoinRoomDialog
        open={showJoinDialog}
        onOpenChange={setShowJoinDialog}
      />
    </div>
  );
}
