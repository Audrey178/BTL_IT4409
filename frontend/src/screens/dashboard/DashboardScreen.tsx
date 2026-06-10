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
import { useUpcomingMeetings } from "@/hooks/dashboard/useUpcomingMeetings";
import { useMeetingReminder } from "@/hooks/dashboard/useMeetingReminder";
import { useFcmMeetingReminders } from "@/hooks/dashboard/useFcmMeetingReminders";

export function DashboardScreen() {
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  const { meetings, loading, refetch } = useUpcomingMeetings();
  useMeetingReminder(meetings);
  useFcmMeetingReminders();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <SideBar
        onNewMeeting={() => setShowCreateDialog(true)}
      />
      {/* Main Content */}
      <main className="lg:ml-64 flex-1 pt-16 lg:pt-0 px-4 md:px-8 lg:px-12 py-6 lg:py-12 bg-surface min-h-screen">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 lg:mb-12">
          <div className="space-y-2">
            <span className="text-primary font-semibold tracking-widest uppercase text-xs">
              Overview
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-on-surface">
              Meeting Schedule
            </h1>
            <p className="text-on-surface-variant max-w-md text-lg">
              Curate your day, connect with your hearth. Your scheduled studio
              sessions are ready.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
              className="h-14 px-8 bg-linear-to-r from-primary to-primary-container text-white rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 group"
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
