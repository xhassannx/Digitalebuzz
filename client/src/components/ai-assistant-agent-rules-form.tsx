import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiAssistantAgentRules } from "@shared/ai-agent-rules";
import { DEFAULT_AGENT_RULES } from "@shared/ai-agent-rules";

type Props = {
  rules: AiAssistantAgentRules;
  onChange: (rules: AiAssistantAgentRules) => void;
  calendarIntegrations: Array<{ id: string; label: string; provider: string }>;
};

export function AiAssistantAgentRulesForm({ rules, onChange, calendarIntegrations }: Props) {
  const set = (patch: Partial<AiAssistantAgentRules>) => onChange({ ...rules, ...patch });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Memory & Knowledge</CardTitle>
          <CardDescription>How the AI remembers and searches your knowledge base</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Conversation memory (turns)</Label>
            <Input
              type="number"
              min={2}
              max={20}
              className="mt-2 max-w-[120px]"
              value={rules.memoryTurns}
              onChange={(e) => set({ memoryTurns: Number(e.target.value) || DEFAULT_AGENT_RULES.memoryTurns })}
            />
            <p className="text-xs text-muted-foreground mt-1">Number of back-and-forth messages the AI remembers</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Smart knowledge search</p>
              <p className="text-xs text-muted-foreground">Search relevant KB sections instead of sending entire files</p>
            </div>
            <Switch checked={rules.useKnowledgeSearch} onCheckedChange={(v) => set({ useKnowledgeSearch: v })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Stop when human replies</p>
              <p className="text-xs text-muted-foreground">Agent stops when your team sends a message from inbox</p>
            </div>
            <Switch checked={rules.stopOnHumanReply} onCheckedChange={(v) => set({ stopOnHumanReply: v })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Working Hours</CardTitle>
          <CardDescription>Auto-reply with after-hours message outside business hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <p className="text-sm font-medium">Enable working hours</p>
            <Switch
              checked={rules.workingHours.enabled}
              onCheckedChange={(v) => set({ workingHours: { ...rules.workingHours, enabled: v } })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Timezone</Label>
              <Input
                className="mt-2"
                value={rules.workingHours.timezone}
                onChange={(e) => set({ workingHours: { ...rules.workingHours, timezone: e.target.value } })}
              />
            </div>
            <div>
              <Label>Weekdays (0=Sun … 6=Sat)</Label>
              <Input
                className="mt-2"
                value={rules.workingHours.weekdays.join(",")}
                onChange={(e) =>
                  set({
                    workingHours: {
                      ...rules.workingHours,
                      weekdays: e.target.value.split(",").map((n) => Number(n.trim())).filter((n) => !Number.isNaN(n)),
                    },
                  })
                }
              />
            </div>
            <div>
              <Label>Start time</Label>
              <Input
                className="mt-2"
                value={rules.workingHours.startTime}
                onChange={(e) => set({ workingHours: { ...rules.workingHours, startTime: e.target.value } })}
              />
            </div>
            <div>
              <Label>End time</Label>
              <Input
                className="mt-2"
                value={rules.workingHours.endTime}
                onChange={(e) => set({ workingHours: { ...rules.workingHours, endTime: e.target.value } })}
              />
            </div>
          </div>
          <div>
            <Label>After-hours message</Label>
            <Textarea
              className="mt-2"
              rows={3}
              value={rules.workingHours.afterHoursMessage}
              onChange={(e) => set({ workingHours: { ...rules.workingHours, afterHoursMessage: e.target.value } })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Follow-up</CardTitle>
          <CardDescription>Reminder if customer does not book or confirm</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <p className="text-sm font-medium">Enable follow-up</p>
            <Switch
              checked={rules.followUp.enabled}
              onCheckedChange={(v) => set({ followUp: { ...rules.followUp, enabled: v } })}
            />
          </div>
          <div>
            <Label>Delay (hours)</Label>
            <Input
              type="number"
              min={0.25}
              step={0.25}
              className="mt-2 max-w-[120px]"
              value={rules.followUp.delayHours}
              onChange={(e) => set({ followUp: { ...rules.followUp, delayHours: Number(e.target.value) || 1 } })}
            />
          </div>
          <div>
            <Label>Follow-up message</Label>
            <Textarea
              className="mt-2"
              rows={3}
              value={rules.followUp.message}
              onChange={(e) => set({ followUp: { ...rules.followUp, message: e.target.value } })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendar booking (in-chat slots)</CardTitle>
          <CardDescription>Show available slots and confirm bookings inside WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <p className="text-sm font-medium">Enable in-chat booking</p>
            <Switch
              checked={rules.calendar.enabled}
              onCheckedChange={(v) => set({ calendar: { ...rules.calendar, enabled: v } })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Provider</Label>
              <select
                className="w-full mt-2 h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={rules.calendar.provider}
                onChange={(e) =>
                  set({
                    calendar: {
                      ...rules.calendar,
                      provider: e.target.value as AiAssistantAgentRules["calendar"]["provider"],
                    },
                  })
                }
              >
                <option value="none">None</option>
                <option value="google-calendar">Google Calendar</option>
                <option value="calendly">Calendly</option>
              </select>
            </div>
            <div>
              <Label>Integration</Label>
              <select
                className="w-full mt-2 h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={rules.calendar.integrationId || ""}
                onChange={(e) => set({ calendar: { ...rules.calendar, integrationId: e.target.value || null } })}
              >
                <option value="">— Auto (first connected) —</option>
                {calendarIntegrations
                  .filter((i) => i.provider === rules.calendar.provider)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label>Slot duration (minutes)</Label>
              <Input
                type="number"
                className="mt-2"
                value={rules.calendar.slotDurationMinutes}
                onChange={(e) =>
                  set({ calendar: { ...rules.calendar, slotDurationMinutes: Number(e.target.value) || 30 } })
                }
              />
            </div>
            <div>
              <Label>Days ahead</Label>
              <Input
                type="number"
                className="mt-2"
                value={rules.calendar.daysAhead}
                onChange={(e) => set({ calendar: { ...rules.calendar, daysAhead: Number(e.target.value) || 3 } })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Connect Google Calendar or Calendly under Integrations, then set Provider (or leave Auto).
            Flow: customer asks to book → bot sends available slots → customer picks a time → bot asks for email →
            creates the event with a Google Meet / booking link and emails the invitation to the customer, then shares the link on WhatsApp.
            If slots cannot be fetched, it falls back to the booking link in your Knowledge Base.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
