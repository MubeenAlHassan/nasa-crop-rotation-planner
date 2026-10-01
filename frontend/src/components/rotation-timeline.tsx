import type { ReactElement } from "react";
import type { Recommendation } from "@/lib/generated/contracts";

export interface RotationTimelineProps {
  recommendation: Recommendation;
}

export function RotationTimeline({ recommendation }: RotationTimelineProps): ReactElement {
  return (
    <section aria-labelledby={`timeline-${recommendation.rotation_id}`}>
      <h3 id={`timeline-${recommendation.rotation_id}`}>Rotation timeline, rank {recommendation.rank}</h3>
      <ol className="grid gap-3 md:grid-cols-2">
        {recommendation.slots.map((slot) => (
          <li key={slot.slot_id} className="rounded border p-3">
            <div className="text-sm">{slot.slot_id.replaceAll("_", " ")}</div>
            <strong>{slot.crop_name}</strong>
            <div>{slot.start_date} to {slot.end_date}</div>
          </li>
        ))}
      </ol>
      <table>
        <caption>Exact returned crop choices and dates, in request order</caption>
        <thead><tr><th scope="col">Slot</th><th scope="col">Crop</th><th scope="col">Start date</th><th scope="col">End date</th></tr></thead>
        <tbody>{recommendation.slots.map((slot) => <tr key={slot.slot_id}>
          <th scope="row">{slot.slot_id}</th><td>{slot.crop_name}</td><td>{slot.start_date}</td><td>{slot.end_date}</td>
        </tr>)}</tbody>
      </table>
    </section>
  );
}
