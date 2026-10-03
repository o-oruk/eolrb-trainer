import { useEffect, useLayoutEffect, useRef } from "react";

type NoteInputProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

// One-line notes box that grows downward a line at a time as the note wraps,
// instead of a fixed single-line input that cuts long hints off.
function NoteInput({ value, placeholder, onChange }: NoteInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  };

  useLayoutEffect(fit, [value]);

  // Wrapping changes with the box's width, so refit when the window resizes.
  useEffect(() => {
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      className="notes-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default NoteInput;
