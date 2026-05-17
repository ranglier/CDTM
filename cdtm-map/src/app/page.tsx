import { StatusCard } from "@/components/status-card";
import { getBaseLayers } from "@/map/layers";
import { getBootstrapStatus } from "@/server/bootstrap-status";
import { createDefaultFilters } from "@/ui/filters";

export default async function HomePage() {
  const status = await getBootstrapStatus();
  const layersCount = getBaseLayers().length;
  const defaultFiltersCount = Object.keys(createDefaultFilters()).length;

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Chroniques de la Terre du Milieu</p>
        <h1>Socle technique initialise pour la carte interactive CDTM</h1>
        <p className="lede">
          Cette etape pose un projet Next.js lancable localement, un environnement
          PostGIS de developpement et les commandes de base pour preparer la suite
          du chantier.
        </p>
      </section>

      <section className="status-grid" aria-label="Etat du bootstrap">
        <StatusCard
          title="Application web"
          accent="earth"
          items={[
            "Next.js / React / TypeScript installes",
            "Structure app router prete dans src/app/",
            "Lint, format et typecheck configures",
          ]}
        />
        <StatusCard
          title="Donnees d'exemple"
          accent="forest"
          items={[
            `${status.exampleFiles.length} fichier(s) d'exemple detecte(s)`,
            `${layersCount} calque(s) de base declares pour l'instant`,
            `${defaultFiltersCount} filtre(s) public(s) preconfigures pour l'instant`,
          ]}
        />
        <StatusCard
          title="Serveur local"
          accent="sand"
          items={[
            status.hasDatabaseUrl
              ? "DATABASE_URL detectee dans l'environnement"
              : "DATABASE_URL absente : copier .env.example vers .env",
            "docker-compose.yml pret pour PostgreSQL + PostGIS",
            "Le script validate:data reste disponible",
          ]}
        />
      </section>

      <section className="panel">
        <h2>Commandes utiles</h2>
        <div className="command-list">
          <code>cp .env.example .env</code>
          <code>docker compose up -d postgis</code>
          <code>npm install</code>
          <code>npm run validate:data</code>
          <code>npm run dev</code>
        </div>
      </section>

      <section className="panel">
        <h2>Jeux d&apos;exemple detectes</h2>
        <ul className="file-list">
          {status.exampleFiles.map((fileName) => (
            <li key={fileName}>{fileName}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
