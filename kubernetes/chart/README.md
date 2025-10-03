# sourcebot

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: v4.5.1](https://img.shields.io/badge/AppVersion-v4.5.1-informational?style=flat-square)

The open source Sourcegraph alternative. Sourcebot gives you a powerful interface to search though all your repos and branches across multiple code hosts.

**Homepage:** <https://sourcebot.dev/>

## Source Code

* <https://github.com/sourcebot-dev/sourcebot>
* <https://github.com/sourcebot-dev/sourcebot/kubernetes/chart>

## Requirements

| Repository | Name | Version |
|------------|------|---------|
| https://charts.bitnami.com/bitnami | postgresql | 16.7.27 |

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| additionalLabels | object | `{}` | Add extra labels to all resources. |
| affinity | object | `{}` | Set affinity rules for pod scheduling. Defaults to soft anti-affinity if not set. See: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/ |
| args | list | `[]` | Override the default arguments of the container. |
| command | list | `[]` | Override the default command of the container. |
| config | object | `{"$schema":"https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v3/index.json","connections":{},"settings":{}}` | Configure Sourcebot-specific application settings. |
| containerSecurityContext | object | `{}` | Set the container-level security context. |
| database | object | `{}` | Configure the database secret by providing database.secretName and database.secretKey to use a Kubernetes secret. |
| envSecrets | list | `[]` | Set environment variables from Kubernetes secrets. |
| envs | list | `[]` | Set additional environment variables. |
| fullnameOverride | string | `""` | Override the full name of the chart. |
| image | object | `{"pullPolicy":"IfNotPresent","repository":"ghcr.io/sourcebot-dev/sourcebot"}` | Configure the container image. |
| image.pullPolicy | string | `"IfNotPresent"` | Image pull policy. |
| image.repository | string | `"ghcr.io/sourcebot-dev/sourcebot"` | Container image repository. |
| imagePullSecrets | list | `[]` | Configure image pull secrets for private registries. |
| ingress | object | `{"annotations":{},"className":"","enabled":false,"hosts":[],"tls":[]}` | Configure ingress for Sourcebot. |
| ingress.annotations | object | `{}` | Ingress annotations. |
| ingress.className | string | `""` | Ingress class name. |
| ingress.enabled | bool | `false` | Enable or disable ingress. |
| ingress.hosts | list | `[]` | List of hostnames and paths for ingress rules. |
| ingress.tls | list | `[]` | TLS settings for ingress. |
| initContainers | list | `[]` | Configure init containers to run before the main container. |
| license | object | `{}` | Configure the enterprise license key secret by providing license.secretName and license.secretKey to use a Kubernetes secret. |
| livenessProbe | object | `{"failureThreshold":5,"httpGet":{"path":"/","port":"http"},"initialDelaySeconds":10,"periodSeconds":10}` | Liveness probe to check if the container is alive. |
| livenessProbe.failureThreshold | int | `5` | Number of consecutive failures before marking the container as unhealthy. |
| livenessProbe.httpGet | object | `{"path":"/","port":"http"}` | Http GET request to check if the container is alive. |
| livenessProbe.httpGet.path | string | `"/"` | Path to check. |
| livenessProbe.httpGet.port | string | `"http"` | Port to check. |
| livenessProbe.initialDelaySeconds | int | `10` | Initial delay before the first probe. |
| livenessProbe.periodSeconds | int | `10` | Frequency of the probe. |
| nameOverride | string | `""` | Override the name of the chart. |
| nodeSelector | object | `{}` | Set node selector constraints. See: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#nodeselector |
| podAnnotations | object | `{}` | Add annotations to the pod metadata. |
| podDisruptionBudget | object | `{"enabled":true,"maxUnavailable":1,"minAvailable":1}` | Configure Pod Disruption Budget. |
| podDisruptionBudget.enabled | bool | `true` | Enable Pod Disruption Budget. |
| podDisruptionBudget.maxUnavailable | int | `1` | Maximum number of pods that can be unavailable. |
| podDisruptionBudget.minAvailable | int | `1` | Minimum number of pods that must be available. |
| podSecurityContext | object | `{}` | Set the pod-level security context. |
| postgresql | object | `{"enabled":false}` | Configure the Bitnami PostgreSQL sub-chart. See: https://artifacthub.io/packages/helm/bitnami/postgresql |
| priorityClassName | string | `""` | Set the priority class name for pods. See: https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/ |
| readinessProbe | object | `{"failureThreshold":5,"httpGet":{"path":"/","port":"http"},"initialDelaySeconds":10,"periodSeconds":10}` | Readiness probe to check if the container is ready to serve traffic. |
| readinessProbe.failureThreshold | int | `5` | Number of consecutive failures before marking the container as not ready. |
| readinessProbe.httpGet | object | `{"path":"/","port":"http"}` | Http GET request to check if the container is ready. |
| readinessProbe.httpGet.path | string | `"/"` | Path to check. |
| readinessProbe.httpGet.port | string | `"http"` | Port to check. |
| readinessProbe.initialDelaySeconds | int | `10` | Initial delay before the first probe. |
| readinessProbe.periodSeconds | int | `10` | Frequency of the probe. |
| redis | object | `{}` | Configure the Redis secret by providing redis.secretName and redis.secretKey to use a Kubernetes secret. |
| replicaCount | int | `1` | Set the number of replicas for the deployment. |
| resources | object | `{}` | Configure resource requests and limits for the container. |
| service | object | `{"annotations":{},"containerPort":3000,"port":3000,"type":"ClusterIP"}` | Configure the Sourcebot Kubernetes service. |
| service.annotations | object | `{}` | Service annotations. |
| service.containerPort | int | `3000` | Internal container port. |
| service.port | int | `3000` | External service port. |
| service.type | string | `"ClusterIP"` | Type of the Kubernetes service (e.g., ClusterIP, NodePort, LoadBalancer). |
| serviceAccount | object | `{"annotations":{},"automount":false,"create":true,"name":""}` | Configure the ServiceAccount. |
| serviceAccount.annotations | object | `{}` | Add annotations to the ServiceAccount. |
| serviceAccount.automount | bool | `false` | Enable or disable automatic ServiceAccount mounting. |
| serviceAccount.create | bool | `true` | Create a new ServiceAccount. |
| serviceAccount.name | string | `""` | Use an existing ServiceAccount (if set). |
| startupProbe | object | `{"failureThreshold":30,"httpGet":{"path":"/","port":"http"},"periodSeconds":30}` | Startup probe to check if the container has started successfully. |
| startupProbe.failureThreshold | int | `30` | Number of seconds to wait before starting the probe. |
| startupProbe.httpGet | object | `{"path":"/","port":"http"}` | Http GET request to check if the container has started. |
| startupProbe.httpGet.path | string | `"/"` | Path to check. |
| startupProbe.httpGet.port | string | `"http"` | Port to check. |
| startupProbe.periodSeconds | int | `30` | Initial delay before the first probe. |
| storage | object | `{"accessModes":["ReadWriteOnce"],"className":"","enabled":true,"size":"10Gi"}` | Configure persistent storage for the application (volume is mounted at /data) to use the internal database. |
| storage.accessModes | list | `["ReadWriteOnce"]` | Access modes for the persistent volume. |
| storage.className | string | `""` | Storage class name for the persistent volume. |
| storage.enabled | bool | `true` | Enable or disable persistent storage. |
| storage.size | string | `"10Gi"` | Size of the persistent volume. |
| tolerations | list | `[]` | Set tolerations for pod scheduling. See: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/ |
| volumeMounts | list | `[]` | Define volume mounts for the container. See: https://kubernetes.io/docs/concepts/storage/volumes/ |
| volumes | list | `[]` | Define additional volumes. See: https://kubernetes.io/docs/concepts/storage/volumes/ |

