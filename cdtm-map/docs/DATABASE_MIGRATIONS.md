# Database Migrations

## Principe

La base PostgreSQL de `cdtm-map` utilise un systeme de migrations versionnees pilote par l'application.

Les migrations appliquees sont tracees dans :

- `schema_migrations`

Chaque ligne enregistre :

- `version`
- `name`
- `applied_at`
- `execution_ms`
- `applied_by`

## Emplacement

Le runner est defini dans :

- `src/server/db-migrations.ts`

Le point d'entree runtime reste :

- `src/server/db.ts`

Au demarrage, l'application :

1. recupere le pool PostgreSQL
2. execute `runDatabaseMigrations(pool)`
3. lance les synchronisations runtime
4. applique les seeds de referentiels

## Regles

- Ne pas ajouter de gros DDL directement dans `db.ts`.
- Toute evolution de schema doit passer par une migration versionnee.
- Ne jamais modifier une migration deja appliquee en production.
- Une migration deja enregistree dans `schema_migrations` ne doit pas etre rejouee.
- Chaque migration doit etre transactionnelle.
- En cas d'echec, la migration courante est rollbackee.
- Ne jamais masquer une migration legacy avec `.catch(() => undefined)`.
- Les operations destructives doivent etre explicites et idempotentes autant que possible.
- La table `schema_migrations` est la source de verite des migrations deja appliquees.
- Les seeds runtime ne remplacent jamais une migration de schema.

## Ajouter une migration

Ajouter une nouvelle entree a la liste `databaseMigrations` dans `src/server/db-migrations.ts` avec :

- une `version` ordonnee
- un `name` explicite
- une fonction `up(client)`
- une version strictement superieure aux migrations existantes

Exemple de structure :

```ts
{
  version: "006",
  name: "example_change",
  up: async (client) => {
    await client.query(`ALTER TABLE ...`);
  },
}
```

## Compatibilite legacy

Les migrations legacy explicites peuvent encore :

- migrer d'anciennes tables vers le modele courant
- supprimer des tables obsoletes une fois la copie terminee
- nettoyer des colonnes heritees

Mais elles ne doivent plus rester cachees dans l'initialisation runtime de `db.ts`.

## Deploiement

- Le healthcheck appelle `ensureDatabaseReady`.
- Si une migration echoue, `/api/health` renvoie `503`.
- Le script de deploiement affiche la derniere reponse health et les logs applicatifs en cas d'echec.
