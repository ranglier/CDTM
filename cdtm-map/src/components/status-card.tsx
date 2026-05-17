type StatusCardProps = {
  title: string;
  items: string[];
  accent?: "earth" | "forest" | "sand";
};

export function StatusCard({
  title,
  items,
  accent = "earth",
}: StatusCardProps) {
  return (
    <article className="status-card" data-accent={accent}>
      <h2>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}
