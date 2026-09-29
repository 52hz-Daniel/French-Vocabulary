# Azure production deployment runbook

This is the one-time account work that cannot be completed by a repository change. It creates Azure Container Registry (ACR), Azure Database for PostgreSQL Flexible Server, and Azure Container Apps, then connects GitHub Actions with OpenID Connect (OIDC).

The commands assume Bash/Zsh, Azure CLI, Docker Desktop, PostgreSQL `psql`, and GitHub CLI. This computer currently has Docker CLI but no running daemon, and `az`/`gh` are not installed.

## 1. Choose globally unique names

```bash
export AZURE_LOCATION=canadacentral
export AZURE_RESOURCE_GROUP=tcf-lab-rg
export ACR_NAME=tcf<your-unique-suffix>
export POSTGRES_SERVER=tcf-pg-<your-unique-suffix>
export CONTAINERAPPS_ENV=tcf-lab-env
export CONTAINER_APP_NAME=tcf-lab
export POSTGRES_ADMIN=tcfadmin
```

```bash
az login
az account set --subscription '<subscription-id>'
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
az group create --name "$AZURE_RESOURCE_GROUP" --location "$AZURE_LOCATION"
az acr create --resource-group "$AZURE_RESOURCE_GROUP" --name "$ACR_NAME" --sku Basic
```

## 2. Create and seed managed PostgreSQL

Generate strong, different database passwords in a password manager. Never commit them or put them in workflow YAML.

```bash
az postgres flexible-server create \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER" \
  --location "$AZURE_LOCATION" \
  --admin-user "$POSTGRES_ADMIN" \
  --admin-password '<strong-admin-password>' \
  --database-name tcf_lab \
  --version 16 \
  --tier Burstable \
  --sku-name Standard_B1ms \
  --storage-size 32 \
  --public-access 0.0.0.0
```

`0.0.0.0` permits Azure services. Add your current public IP temporarily so the laptop can seed the server:

```bash
az postgres flexible-server firewall-rule create \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER" \
  --rule-name seed-from-laptop \
  --start-ip-address '<your-public-ip>' \
  --end-ip-address '<your-public-ip>'
psql "host=$POSTGRES_SERVER.postgres.database.azure.com port=5432 dbname=tcf_lab user=$POSTGRES_ADMIN sslmode=require"
```

In `psql`, create the roles expected by the committed migrations:

```sql
CREATE ROLE tcf_app LOGIN PASSWORD '<strong-app-password>';
CREATE ROLE tcf_ingest LOGIN PASSWORD '<strong-ingest-password>';
GRANT CONNECT ON DATABASE tcf_lab TO tcf_app, tcf_ingest;
GRANT USAGE ON SCHEMA public TO tcf_app, tcf_ingest;
```

Set temporary TLS URLs locally, run the reviewed migrations, import the processed listening data, and verify exact counts/completeness:

```bash
export DATABASE_ADMIN_URL='postgresql://tcfadmin:<admin-password>@<server>.postgres.database.azure.com:5432/tcf_lab?sslmode=require'
export DATABASE_INGEST_URL='postgresql://tcf_ingest:<ingest-password>@<server>.postgres.database.azure.com:5432/tcf_lab?sslmode=require'
pnpm db:migrate
pnpm db:import:listening
pnpm db:verify
unset DATABASE_ADMIN_URL DATABASE_INGEST_URL
az postgres flexible-server firewall-rule delete --resource-group "$AZURE_RESOURCE_GROUP" --name "$POSTGRES_SERVER" --rule-name seed-from-laptop --yes
```

This seed makes the processed 42-transcript study records available to all app revisions. Raw/private sources stay local.

## 3. Build and push the first image

Start Docker Desktop and make sure `docker info` succeeds.

```bash
az acr login --name "$ACR_NAME"
docker build -t "$ACR_NAME.azurecr.io/tcf-lab:initial" .
docker push "$ACR_NAME.azurecr.io/tcf-lab:initial"
```

ACR stores image versions; it does not run them.

## 4. Create Azure Container Apps

```bash
az containerapp env create --name "$CONTAINERAPPS_ENV" --resource-group "$AZURE_RESOURCE_GROUP" --location "$AZURE_LOCATION"
az containerapp create \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --environment "$CONTAINERAPPS_ENV" \
  --image mcr.microsoft.com/k8se/quickstart:latest \
  --target-port 80 \
  --ingress external
az containerapp identity assign --name "$CONTAINER_APP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --system-assigned
export APP_PRINCIPAL_ID=$(az containerapp identity show --name "$CONTAINER_APP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --query principalId --output tsv)
export ACR_ID=$(az acr show --name "$ACR_NAME" --query id --output tsv)
az role assignment create --assignee-object-id "$APP_PRINCIPAL_ID" --assignee-principal-type ServicePrincipal --role AcrPull --scope "$ACR_ID"
az containerapp registry set --name "$CONTAINER_APP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --server "$ACR_NAME.azurecr.io" --identity system
az containerapp secret set \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --secrets database-url='postgresql://tcf_app:<app-password>@<server>.postgres.database.azure.com:5432/tcf_lab?sslmode=require'
az containerapp update \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --image "$ACR_NAME.azurecr.io/tcf-lab:initial" \
  --min-replicas 1 \
  --set-env-vars DEV_USER_ID=00000000-0000-4000-8000-000000000001 DATABASE_URL=secretref:database-url DATABASE_POOL_MAX=10
az containerapp ingress update \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --target-port 3000
```

```bash
export APP_FQDN=$(az containerapp show --name "$CONTAINER_APP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --query properties.configuration.ingress.fqdn --output tsv)
curl --fail "https://$APP_FQDN/api/health"
```

## 5. Connect GitHub Actions using OIDC

Create a Microsoft Entra application/service principal scoped to this resource group, add a federated credential whose subject is the repository's `production` GitHub environment, and grant it `Contributor` on the resource group plus `AcrPush` on ACR. Use GitHub's current Azure OIDC guide for that account-level procedure.

Create a protected GitHub environment named `production`. Add repository secrets:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Add repository variables:

- `ACR_NAME`
- `AZURE_RESOURCE_GROUP`
- `AZURE_CONTAINER_APP_NAME`

The workflow needs no long-lived Azure password or PostgreSQL password. Container Apps retains `database-url` when CI changes only the image. Push a visible commit to `master` (the current default branch), then confirm both jobs under **Actions → CI/CD** pass.

## 6. Final acceptance test

Open the Azure URL in a private browser window and verify:

1. `/api/health` reports `ok` and `connected`.
2. Today shows non-zero data and the TCF Listening collection.
3. Library search/filtering returns imported vocabulary.
4. A Learn item displays its sentence, meaning, and morphology.
5. Review accepts an answer and Progress changes.
6. French audio works in a supported browser.
7. Refresh and a subsequent deployment preserve progress.

Replace the README live-demo placeholder with the HTTPS URL, add actual Today and Review screenshots under `docs/screenshots/`, and add the same Live Demo/GitHub links to the résumé.

## Security and cost

- The app currently exposes one shared demo identity. Do not use it for private data.
- Keep source corpora, dictionary dumps, generated JSON, and credentials out of Git/images.
- Configure an Azure budget alert and review PostgreSQL/minimum-replica costs.
- A hardened multi-user deployment needs authentication and private database networking.

## Current vendor references

- [Azure Container Apps image pull with managed identity](https://learn.microsoft.com/azure/container-apps/managed-identity-image-pull)
- [Azure PostgreSQL Flexible Server quickstart](https://learn.microsoft.com/azure/postgresql/configure-maintain/quickstart-create-server)
- [GitHub OIDC authentication with Azure](https://docs.github.com/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure)
