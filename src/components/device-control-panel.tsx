"use client";

import { useState } from "react";
import {
  Cable,
  CirclePower,
  House,
  MonitorCog,
  Power,
  RefreshCw,
  Router,
  ShieldCheck,
} from "lucide-react";
import { queueDeviceCommand, setCecKeepActive } from "@/app/dashboard/actions";
import type { DeviceCommandType } from "@/lib/shared";

type CommandStatus = {
  id: string;
  command: DeviceCommandType;
  status: "queued" | "running" | "succeeded" | "failed" | "expired";
  result: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  claimed_at: string | null;
  completed_at: string | null;
  expires_at: string;
};

const groups: Array<{
  title: string;
  actions: Array<{
    command: DeviceCommandType;
    label: string;
    icon: typeof Power;
    danger?: boolean;
  }>;
}> = [
  {
    title: "HDMI-CEC",
    actions: [
      { command: "cec_turn_on", label: "Turn TV On", icon: CirclePower },
      { command: "cec_turn_off", label: "Turn TV Off", icon: Power },
      { command: "cec_active_source", label: "Switch to This HDMI", icon: Cable },
      { command: "cec_read_status", label: "Read CEC Status", icon: RefreshCw },
    ],
  },
  {
    title: "Device setup",
    actions: [
      { command: "open_wifi_settings", label: "Open Wi-Fi Settings", icon: Router },
      { command: "launcher_make_default", label: "Make App Home", icon: House },
    ],
  },
  {
    title: "Stock launcher",
    actions: [
      {
        command: "launcher_disable_stock",
        label: "Disable Stock Launcher",
        icon: MonitorCog,
        danger: true,
      },
      {
        command: "launcher_enable_stock",
        label: "Enable Stock Launcher",
        icon: ShieldCheck,
      },
    ],
  },
];

const labels = new Map(
  groups.flatMap((group) => group.actions.map((action) => [action.command, action.label])),
);

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function ResultDetails({ command }: { command: CommandStatus }) {
  const result = command.result ?? {};
  const statusFields = [
    ["Physical address", result.physicalAddress],
    ["Port status", result.portStatus],
    ["Pin status", result.pinStatus],
    ["Current HOME", result.currentHome],
  ].filter((field): field is [string, unknown] => field[1] !== undefined && field[1] !== "");

  return (
    <div className={`device-command-result ${command.status}`} aria-live="polite">
      <div className="device-command-result-header">
        <div>
          <strong>{labels.get(command.command) ?? command.command}</strong>
          <span>{command.status === "succeeded" ? "Completed" : command.status}</span>
        </div>
        {command.completed_at ? (
          <time dateTime={command.completed_at}>
            {new Date(command.completed_at).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
            })}
          </time>
        ) : null}
      </div>
      {statusFields.length ? (
        <dl className="device-command-values">
          {statusFields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {command.error_message ? <p className="device-command-error">{command.error_message}</p> : null}
      {typeof result.output === "string" && result.output ? (
        <pre>{result.output}</pre>
      ) : null}
    </div>
  );
}

export function DeviceControlPanel({
  screenId,
  hasActiveDevice,
  online,
  keepActiveEnabled,
  tvStatus,
  channelStatus,
}: {
  screenId: string;
  hasActiveDevice: boolean;
  online: boolean;
  keepActiveEnabled: boolean;
  tvStatus: string;
  channelStatus: string;
}) {
  const [busyCommand, setBusyCommand] = useState<DeviceCommandType | null>(null);
  const [status, setStatus] = useState<CommandStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keepActive, setKeepActive] = useState(keepActiveEnabled);

  async function run(command: DeviceCommandType) {
    if (
      command === "launcher_disable_stock" &&
      !window.confirm(
        "Disable the Google TV launcher on this screen? Keep the recovery action available until HOME behavior is verified.",
      )
    ) {
      return;
    }

    setBusyCommand(command);
    setStatus(null);
    setError(null);
    try {
      const queued = await queueDeviceCommand(screenId, command);
      const deadline = Date.now() + 65_000;
      while (Date.now() < deadline) {
        const response = await fetch(
          `/api/dashboard/screens/${encodeURIComponent(screenId)}/device-commands/${encodeURIComponent(queued.id)}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error?.message ?? "Could not read command status.");
        }
        setStatus(data);
        if (["succeeded", "failed", "expired"].includes(data.status)) return;
        await wait(1_000);
      }
      throw new Error("The device did not finish the command within 60 seconds.");
    } catch (commandError) {
      setError(
        commandError instanceof Error ? commandError.message : String(commandError),
      );
    } finally {
      setBusyCommand(null);
    }
  }

  async function toggleKeepActive(enabled: boolean) {
    setKeepActive(enabled);
    setError(null);
    try {
      await setCecKeepActive(screenId, enabled);
    } catch (toggleError) {
      setKeepActive(!enabled);
      setError(toggleError instanceof Error ? toggleError.message : String(toggleError));
    }
  }

  return (
    <section className="panel device-control-panel">
      <div className="device-control-heading">
        <div>
          <span className="eyebrow">Testing tools</span>
          <h2>Device controls</h2>
          <p>Run fixed native commands on the paired H95 Max player.</p>
        </div>
        <span className={`badge ${online ? "success" : "warning"}`}>
          {online ? "Player online" : "Player offline"}
        </span>
      </div>

      {!hasActiveDevice ? (
        <p className="notice danger">Connect a player before sending device commands.</p>
      ) : null}
      {hasActiveDevice && !online ? (
        <p className="notice">Commands expire after 60 seconds if the player remains offline.</p>
      ) : null}

      <div className="cec-state-row" aria-label="CEC status">
        <div><span>TV status</span><strong>{tvStatus}</strong></div>
        <div><span>Channel status</span><strong>{channelStatus}</strong></div>
        <button
          className="button"
          disabled={!hasActiveDevice || busyCommand !== null}
          onClick={() => void run("cec_activate_player")}
          type="button"
        >
          <CirclePower aria-hidden="true" />
          Activate TV + Player HDMI
        </button>
      </div>

      <label className="cec-keep-active-switch">
        <input
          checked={keepActive}
          disabled={!hasActiveDevice}
          onChange={(event) => void toggleKeepActive(event.target.checked)}
          type="checkbox"
        />
        <span>Keep TV on this player HDMI every 10 minutes</span>
      </label>

      <div className="device-control-groups">
        {groups.map((group) => (
          <div className="device-control-group" key={group.title}>
            <h3>{group.title}</h3>
            <div className="device-control-actions">
              {group.actions.map(({ command, label, icon: Icon, danger }) => (
                <button
                  className={`button secondary${danger ? " device-control-danger" : ""}`}
                  disabled={!hasActiveDevice || busyCommand !== null}
                  key={command}
                  onClick={() => void run(command)}
                  type="button"
                >
                  <Icon aria-hidden="true" />
                  {busyCommand === command ? "Sending…" : label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {status ? <ResultDetails command={status} /> : null}
      {error ? <p className="notice danger device-command-error">{error}</p> : null}
    </section>
  );
}
