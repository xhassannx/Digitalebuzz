import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";
import { NovaWorldMap } from "./NovaWorldMap";
import {
  computeCountryBreakdown,
  formatCompactUsers,
  type CountryStat,
} from "./computeCountryBreakdown";

type NovaUsersByCountryCardProps = {
  totalContacts: number;
};

export function NovaUsersByCountryCard({
  totalContacts,
}: NovaUsersByCountryCardProps) {
  const { data: contacts = [] } = useQuery<Array<{ phoneNumber?: string | null }>>({
    queryKey: ["/api/contacts", "nova-dashboard-countries"],
    queryFn: () => fetchLegacyListApi<{ phoneNumber?: string | null }>("/api/contacts", "contacts"),
    staleTime: 60_000,
  });

  const { total, countries } = useMemo(
    () => computeCountryBreakdown(contacts, totalContacts),
    [contacts, totalContacts],
  );

  const displayTotal = total > 0 ? total : totalContacts;
  const topCountry = countries[0];
  const markerKeys = countries.map((c) => c.mapKey);

  return (
    <div className="nova-panel-card nova-users-country flex h-full min-h-[280px] flex-col p-4 sm:p-5">
      <div className="nova-users-country__layout">
        <div className="nova-users-country__stats">
          <h2 className="nova-users-country__title">Users by country</h2>
          <div className="nova-users-country__metric-row">
            <span className="nova-users-country__metric">{formatCompactUsers(displayTotal)}</span>
          </div>
          {countries.length === 0 ? (
            <p className="text-xs text-[#9ca3af] mt-3">
              No contacts yet. Add contacts or connect WhatsApp to see country breakdown.
            </p>
          ) : (
          <ul className="nova-users-country__list">
            {countries.map((country) => (
              <CountryRow key={country.mapKey} country={country} />
            ))}
          </ul>
          )}
        </div>
        <div className="nova-users-country__map">
          <NovaWorldMap activeMapKey={topCountry?.mapKey} markerKeys={markerKeys} />
        </div>
      </div>
    </div>
  );
}

function CountryRow({ country }: { country: CountryStat }) {
  return (
    <li className="nova-users-country__row">
      <span className="nova-users-country__name">{country.name}</span>
      <div className="nova-users-country__bar-wrap">
        <div
          className="nova-users-country__bar"
          style={{ width: `${Math.max(country.percent, 4)}%` }}
        />
      </div>
      <span className="nova-users-country__pct">{country.percent}%</span>
    </li>
  );
}
