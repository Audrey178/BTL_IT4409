import {
  Archive,
  CalendarIcon,
  Flame,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Settings,
} from "lucide-react";
import React from "react";
import NavItem from "./NavItem";
import { Button } from "@base-ui/react/button";
import { useNavigate, useLocation } from "react-router";
import { useAuthStore } from "@/stores/useAuthStore";

interface SideBarProps {
  onNewMeeting?: () => void;
}

const SideBar = ({ onNewMeeting }: SideBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div>
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
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavItem
            icon={<LayoutDashboard size={20} />}
            label="Meetings"
            active={isActive("/")}
            onClick={() => navigate("/")}
          />
          <NavItem
            icon={<CalendarIcon size={20} />}
            label="Schedule"
            active={isActive("/schedule")}
            onClick={() => navigate("/schedule")}
          />
          <NavItem
            icon={<MessageSquare size={20} />}
            label="Messages"
            active={isActive("/messages")}
            onClick={() => navigate("/messages")}
          />
          <NavItem
            icon={<Archive size={20} />}
            label="Archives"
            active={isActive("/archives")}
            onClick={() => navigate("/archives")}
          />
        </nav>

        <div className="px-6 mb-8">
          <Button
            onClick={onNewMeeting}
            className="w-full h-12 bg-primary text-white rounded-full font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            New Meeting
          </Button>
        </div>

        <div className="p-6 space-y-4 border-t border-outline-variant/10">
          <button className="flex items-center gap-4 text-on-surface-variant hover:text-primary transition-colors w-full">
            <HelpCircle size={20} />
            <span className="text-sm font-medium">Support</span>
          </button>
          <button
            onClick={() => navigate("/profile")}
            className={`flex items-center gap-4 transition-colors w-full px-1 py-2 rounded ${isActive("/profile") ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}
          >
            <Settings size={20} />
            <span className="text-sm font-medium">Settings</span>
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-4 text-error hover:opacity-80 transition-colors w-full pt-2"
          >
            <span className="text-sm font-bold">Logout</span>
          </button>
        </div>
      </aside>
    </div>
  );
};

export default SideBar;
