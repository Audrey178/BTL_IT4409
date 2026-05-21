import React from "react";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const NavItem = ({ icon, label, active = false, onClick }: NavItemProps) => {
  return (
    <button
      onClick={onClick}
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
};

export default NavItem;
