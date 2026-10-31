import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChipGroup } from "@/components/chip-group";

afterEach(cleanup);

const SMOKING = [
  { value: "no_smoking", label: "禁煙" },
  { value: "separated", label: "分煙" },
  { value: "unknown", label: "不明" },
] as const;

describe("ChipGroup", () => {
  it("単一選択: 押すと値が通知され、もう一度押すと unknown に戻る", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ChipGroup options={SMOKING} value="unknown" onChange={onChange} name="smoking" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "禁煙" }));
    expect(onChange).toHaveBeenLastCalledWith("no_smoking");

    rerender(
      <ChipGroup options={SMOKING} value="no_smoking" onChange={onChange} name="smoking" />,
    );
    const chip = screen.getByRole("button", { name: "禁煙" });
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(chip);
    expect(onChange).toHaveBeenLastCalledWith("unknown");
  });

  it("単一選択: unknown のチップは表示しない", () => {
    render(<ChipGroup options={SMOKING} value="unknown" onChange={() => {}} name="smoking" />);
    expect(screen.queryByRole("button", { name: "不明" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("単一選択: hidden input に値を出す", () => {
    const { container } = render(
      <ChipGroup options={SMOKING} value="separated" onChange={() => {}} name="smoking" />,
    );
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="hidden"]');
    expect(inputs).toHaveLength(1);
    expect(inputs[0].name).toBe("smoking");
    expect(inputs[0].value).toBe("separated");
  });

  it("複数選択: 2つ押すと2要素の配列になり、hidden input は値ごとに出る", () => {
    const onChange = vi.fn();
    const PAY = [
      { value: "cash", label: "現金" },
      { value: "card", label: "カード" },
    ];
    function Harness() {
      return <ChipGroup multiple options={PAY} value={[]} onChange={onChange} name="pay" />;
    }
    const { rerender, container } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "現金" }));
    expect(onChange).toHaveBeenLastCalledWith(["cash"]);

    rerender(
      <ChipGroup multiple options={PAY} value={["cash"]} onChange={onChange} name="pay" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "カード" }));
    expect(onChange).toHaveBeenLastCalledWith(["cash", "card"]);

    rerender(
      <ChipGroup multiple options={PAY} value={["cash", "card"]} onChange={onChange} name="pay" />,
    );
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="hidden"]');
    expect([...inputs].map((i) => [i.name, i.value])).toEqual([
      ["pay", "cash"],
      ["pay", "card"],
    ]);
    fireEvent.click(screen.getByRole("button", { name: "現金" }));
    expect(onChange).toHaveBeenLastCalledWith(["card"]);
  });
});
