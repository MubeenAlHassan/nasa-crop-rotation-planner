// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FieldMap } from "./field-map";

const leaf = vi.hoisted(() => {
  const map = { setView: vi.fn(), on: vi.fn(), remove: vi.fn() };
  map.setView.mockReturnValue(map);
  const tile = { on: vi.fn(), addTo: vi.fn() };
  tile.on.mockReturnValue(tile);
  return { map, tile, mapFactory: vi.fn(() => map), tileFactory: vi.fn(() => tile) };
});
vi.mock("leaflet", () => ({
  default: { map: leaf.mapFactory, tileLayer: leaf.tileFactory },
  map: leaf.mapFactory, tileLayer: leaf.tileFactory,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FieldMap", () => {
  it("translates Leaflet latitude/longitude in order and rejects out-of-bounds clicks", async () => {
    const onChange = vi.fn();
    render(<FieldMap initialLocation={null} onChange={onChange} disabled={false} />);
    await waitFor(() => expect(leaf.map.on).toHaveBeenCalledWith("click", expect.any(Function)));
    const click = leaf.map.on.mock.calls.find(([name]) => name === "click")?.[1];
    click({ latlng: { lat: 31.4504, lng: 73.135 } });
    expect(onChange).toHaveBeenCalledWith({ latitude: 31.4504, longitude: 73.135 });
    click({ latlng: { lat: 91, lng: 73 } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(leaf.tileFactory).toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ attribution: expect.stringContaining("OpenStreetMap") }));
  });

  it("supports keyboard coordinates and validates bounds", async () => {
    const onChange = vi.fn();
    render(<FieldMap initialLocation={{ latitude: 31, longitude: 73 }} onChange={onChange} disabled={false} />);
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "0" } });
    expect(onChange).toHaveBeenLastCalledWith({ latitude: 0, longitude: 73 });
    fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "181" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(leaf.mapFactory).toHaveBeenCalled());
  });

  it("honors disabled state and keeps entry available on tile failure", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<FieldMap initialLocation={null} onChange={onChange} disabled={true} />);
    await waitFor(() => expect(leaf.map.on).toHaveBeenCalled());
    const click = leaf.map.on.mock.calls.find(([name]) => name === "click")?.[1];
    click({ latlng: { lat: 31, lng: 73 } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Latitude")).toBeDisabled();
    rerender(<FieldMap initialLocation={{ latitude: 0, longitude: 0 }} onChange={onChange} disabled={false} />);
    expect(screen.getByLabelText("Latitude")).toHaveValue(0);
    expect(screen.getByLabelText("Longitude")).toHaveValue(0);
    click({ latlng: { lat: 31, lng: 73 } });
    expect(onChange).toHaveBeenCalledWith({ latitude: 31, longitude: 73 });
    const tileError = leaf.tile.on.mock.calls.find(([name]) => name === "tileerror")?.[1];
    tileError();
    expect(await screen.findByText(/Coordinate entry remains available/)).toBeInTheDocument();
    expect(screen.getByLabelText("Latitude")).toBeEnabled();
  });
});
