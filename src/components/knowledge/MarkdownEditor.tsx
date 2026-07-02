import MDEditor from '@uiw/react-md-editor';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
}

export default function MarkdownEditor({ value, onChange, height = 500 }: MarkdownEditorProps) {
  return (
    <div data-color-mode="light">
      <MDEditor value={value} onChange={(v) => onChange(v || '')} height={height} />
    </div>
  );
}
