const axios = require("axios");
const config = require("../../config");
const organizationsService = require("../organizations/service");
const { IikoService } = require("../stopList/iikoService");
const sseService = require("./sseService");

const iikoService = new IikoService();

function getRequiredWebhookToken() {
  const webhookToken = String(process.env.IIKO_WEBHOOK_TOKEN || "").trim();
  if (!webhookToken) {
    const error = new Error("IIKO_WEBHOOK_TOKEN обязателен для webhook-интеграции");
    error.statusCode = 500;
    throw error;
  }
  return webhookToken;
}

async function receiveIikoWebhook(req, res) {
  try {
    const webhookToken = getRequiredWebhookToken();
    const authHeader = req.headers.authorization || req.headers["x-auth-token"];
    const receivedToken = authHeader?.replace(/^Bearer\s+/i, "");

    if (!receivedToken || receivedToken !== webhookToken) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const events = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
      const { eventType, organizationId } = event || {};
      console.log(`🔔 iiko webhook: ${eventType} для org ${organizationId}`);

      if (eventType === "StopListUpdate") {
        sseService.broadcast("stopListUpdate", {
          organizationId,
          eventTime: event.eventTime,
        });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Webhook processing error" });
  }
}

function stopListEvents(req, res) {
  sseService.addClient(res);
  console.log(`📡 SSE-клиент подключён (всего: ${sseService.clientCount})`);
}

async function registerIikoWebhook(req, res) {
  const { organizationIds, webHooksUri } = req.body || {};

  if (!webHooksUri) {
    return res.status(400).json({ error: "webHooksUri обязателен" });
  }

  try {
    const allOrganizations = await organizationsService.getOrganizations().catch(() => []);
    const orgs = Array.isArray(organizationIds) && organizationIds.length > 0 ? organizationIds : allOrganizations.map((org) => org.id).filter(Boolean);
    const webhookToken = getRequiredWebhookToken();
    const baseUrl = config.iiko.baseUrl || "https://api-ru.iiko.services/api/1";
    const token = await iikoService.fetchAccessToken();
    const results = [];

    for (const orgId of orgs) {
      try {
        const response = await axios.post(
          `${baseUrl}/webhooks/update_settings`,
          {
            organizationId: orgId,
            webHooksUri,
            authToken: webhookToken,
            webHooksFilter: {
              stopListUpdateFilter: {
                returnSize: false,
              },
            },
          },
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000,
          },
        );

        results.push({ orgId, status: "ok", correlationId: response.data?.correlationId });
      } catch (error) {
        results.push({ orgId, status: "error", error: error.response?.data?.description || error.message });
      }
    }

    return res.json({ success: true, results });
  } catch (error) {
    return res.status(error.statusCode || 502).json({ success: false, error: error.message });
  }
}

module.exports = { receiveIikoWebhook, stopListEvents, registerIikoWebhook };

