// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FieldMap } from "./field-map";

const leaf = vi.hoisted(() => {
  const map = { setView: vi.fn(), on: vi.fn(), remove: vi.fn(), invalidateSize: vi.fn() };
  map.setView.mockReturnValue(map);
  const tile = { on: vi.fn(), addTo: vi.fn() };
  tile.on.mockReturnValue(tile);
  return { map, tile, mapFactory: vi.fn(() => map), tileFactory: vi.fn(() => tile) };
});

const weather = vi.hoisted(() => ({
  searchPlaces: vi.fn(),
  reverseGeocode: vi.fn(),
  formatPlaceLabel: vi.fn((place: { name: string; admin1: string | null; country: string }) =>
    [place.name, place.admin1, place.country].filter(Boolean).join(", ")),
}));

vi.mock("../lib/weather/open-meteo", () => ({
  searchPlaces: weather.searchPlaces,
  reverseGeocode: weather.reverseGeocode,
  formatPlaceLabel: weather.formatPlaceLabel,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  document.querySelectorAll("[data-leaflet-js],[data-leaflet-css]").forEach((node) => node.remove());
});

function stubLeaflet(): void {
  vi.stubGlobal("L", {
    map: leaf.mapFactory,
    tileLayer: leaf.tileFactory,
  });
}

describe("FieldMap", () => {
  it("translates Leaflet latitude/longitude in order and rejects out-of-bounds clicks", async () => {
    stubLeaflet();
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
    stubLeaflet();
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
    stubLeaflet();
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
    expect(leaf.map.setView).toHaveBeenLastCalledWith([0, 0]);
    click({ latlng: { lat: 31, lng: 73 } });
    expect(onChange).toHaveBeenCalledWith({ latitude: 31, longitude: 73 });
    const tileError = leaf.tile.on.mock.calls.find(([name]) => name === "tileerror")?.[1];
    tileError();
    expect(await screen.findByText(/Coordinate entry remains available/)).toBeInTheDocument();
    expect(screen.getByLabelText("Latitude")).toBeEnabled();
  });

  it("applies a searched place suggestion to the map coordinates", async () => {
    stubLeaflet();
    const onChange = vi.fn();
    weather.searchPlaces.mockResolvedValue([
      {
        id: "1",
        name: "Faisalabad",
        latitude: 31.4504,
        longitude: 73.135,
        country: "Pakistan",
        admin1: "Punjab",
        timezone: "Asia/Karachi",
      },
    ]);
    render(<FieldMap initialLocation={null} onChange={onChange} disabled={false} />);
    fireEvent.change(screen.getByLabelText("Search a place"), { target: { value: "Faisalabad" } });
    expect(await screen.findByRole("button", { name: /Faisalabad/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Faisalabad/i }));
    expect(onChange).toHaveBeenCalledWith({ latitude: 31.4504, longitude: 73.135 });
    expect(screen.getByLabelText("Latitude")).toHaveValue(31.4504);
    expect(screen.getByLabelText("Longitude")).toHaveValue(73.135);
    expect(screen.getByText("Faisalabad, Punjab, Pakistan")).toBeInTheDocument();
  });

  it("uses the browser current location and fills coordinates", async () => {
    stubLeaflet();
    const onChange = vi.fn();
    weather.reverseGeocode.mockResolvedValue({
      id: "coords",
      name: "Lahore",
      latitude: 31.52,
      longitude: 74.35,
      country: "Pakistan",
      admin1: "Punjab",
      timezone: null,
    });
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: {
              latitude: 31.52,
              longitude: 74.35,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition);
        },
      },
    });
    // Keep Leaflet global after navigator stub.
    stubLeaflet();
    render(<FieldMap initialLocation={null} onChange={onChange} disabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: /current location/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ latitude: 31.52, longitude: 74.35 }));
    expect(screen.getByLabelText("Latitude")).toHaveValue(31.52);
    expect(screen.getByLabelText("Longitude")).toHaveValue(74.35);
    expect(await screen.findByText("Lahore, Punjab, Pakistan")).toBeInTheDocument();
  });
});
