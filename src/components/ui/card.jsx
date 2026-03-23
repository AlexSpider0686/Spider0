import React from "react";

function joinClasses(...items) {
  return items.filter(Boolean).join(" ");
}

export function Card({ className = "", ...props }) {
  return <div className={joinClasses("rounded-xl border border-slate-200 bg-white/90 shadow-sm", className)} {...props} />;
}

export function CardHeader({ className = "", ...props }) {
  return <div className={joinClasses("p-4 pb-2", className)} {...props} />;
}

export function CardTitle({ className = "", ...props }) {
  return <h3 className={joinClasses("text-sm font-semibold text-slate-900", className)} {...props} />;
}

export function CardDescription({ className = "", ...props }) {
  return <p className={joinClasses("text-xs text-slate-500", className)} {...props} />;
}

export function CardContent({ className = "", ...props }) {
  return <div className={joinClasses("p-4 pt-2", className)} {...props} />;
}

export function CardFooter({ className = "", ...props }) {
  return <div className={joinClasses("p-4 pt-2", className)} {...props} />;
}

export default Card;
