import Link from "next/link";

interface Props {
  active: "analytics" | "users";
}

export function AdminTabs({ active }: Props) {
  const tabs = [
    { id: "analytics", label: "Analytics", href: "/admin" },
    { id: "users", label: "Users", href: "/admin/users" },
  ] as const;

  return (
    <div className="flex gap-1 mb-8 border-b border-gray-200">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === tab.id
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
