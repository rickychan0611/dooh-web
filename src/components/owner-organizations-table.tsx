"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trials" },
  { value: "grace", label: "Grace" },
  { value: "suspended", label: "Suspended" },
  { value: "canceled", label: "Canceled" },
] as const;

type OrganizationRow = {
  id: string;
  name: string;
  status: string;
  screen_license_quantity: number | null;
  billing_currency: string;
  created_at: string;
  screens?: { count: number }[];
};

export function OwnerOrganizationsTable({ organizations }: { organizations: OrganizationRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]["value"]>("all");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return organizations.filter((organization) => {
      const matchesStatus = status === "all" || organization.status === status;
      const matchesQuery =
        !term ||
        organization.name.toLowerCase().includes(term) ||
        organization.status.toLowerCase().includes(term) ||
        organization.billing_currency.toLowerCase().includes(term);
      return matchesStatus && matchesQuery;
    });
  }, [organizations, query, status]);

  return (
    <section className="panel table-wrap">
      <div className="owner-toolbar">
        <label className="owner-search">
          <span className="sr-only">Search organizations</span>
          <Search aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by business name"
          />
        </label>
        <label className="owner-filter">
          <span className="sr-only">Filter by status</span>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as (typeof STATUS_FILTERS)[number]["value"])
            }
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filtered.length ? (
        <table>
          <thead>
            <tr>
              <th>Business</th>
              <th>Status</th>
              <th>Licenses</th>
              <th>Screens</th>
              <th>Currency</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((organization) => (
              <tr key={organization.id}>
                <td>
                  <Link href={`/owner/organizations/${organization.id}`}>
                    <strong>{organization.name}</strong>
                  </Link>
                </td>
                <td>
                  <span
                    className={`badge ${
                      organization.status === "active"
                        ? "success"
                        : organization.status === "grace"
                          ? "warning"
                          : ""
                    }`}
                  >
                    {organization.status}
                  </span>
                </td>
                <td>{organization.screen_license_quantity}</td>
                <td>{organization.screens?.[0]?.count ?? 0}</td>
                <td>{organization.billing_currency.toUpperCase()}</td>
                <td>{new Date(organization.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted owner-empty">
          {organizations.length
            ? "No organizations match this search or filter."
            : "No organizations yet."}
        </p>
      )}
    </section>
  );
}
