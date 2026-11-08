package br.com.petstory.server;

import br.com.petstory.model.Prescricao;
import br.com.petstory.service.ProntuarioService;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.util.List;

/**
 * ============================================================================
 * HANDLER HTTP: PrescricaoPostHandler (POST /api/prescricoes e GET /api/prescricoes)
 * ============================================================================
 * Registra medicamentos ativos com posologia vinculados ao pet no prontuário.
 */
public class PrescricaoPostHandler implements HttpHandler {

    private final ProntuarioService prontuarioService;

    public PrescricaoPostHandler(ProntuarioService prontuarioService) {
        this.prontuarioService = prontuarioService;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (HttpHelper.tratarCors(exchange)) {
            return;
        }

        String metodo = exchange.getRequestMethod();

        if ("GET".equalsIgnoreCase(metodo)) {
            String query = exchange.getRequestURI().getQuery();
            String petId = "PST-1428";
            if (query != null && query.contains("=")) {
                String[] params = query.split("&");
                for (String param : params) {
                    String[] kv = param.split("=");
                    if (kv.length == 2 && ("petId".equalsIgnoreCase(kv[0]) || "pet_id".equalsIgnoreCase(kv[0]) || "tag".equalsIgnoreCase(kv[0]))) {
                        petId = kv[1];
                        break;
                    }
                }
            }
            List<Prescricao> lista = prontuarioService.listarPrescricoes(petId);
            JsonObject resp = new JsonObject();
            resp.addProperty("sucesso", true);
            resp.add("prescricoes", HttpHelper.getGson().toJsonTree(lista));
            HttpHelper.enviarJson(exchange, 200, resp);
            return;
        }

        if (!"POST".equalsIgnoreCase(metodo)) {
            HttpHelper.enviarErro(exchange, 405, "METODO_NAO_PERMITIDO", "Método não permitido. Utilize POST ou GET.");
            return;
        }

        JsonObject body = HttpHelper.lerCorpoJson(exchange);

        String petId = null;
        if (body.has("petId")) petId = body.get("petId").getAsString();
        else if (body.has("pet_id")) petId = body.get("pet_id").getAsString();
        else if (body.has("tag")) petId = body.get("tag").getAsString();

        String nome = body.has("nome") ? body.get("nome").getAsString() : null;
        if (nome == null || nome.trim().isEmpty()) {
            HttpHelper.enviarErro(exchange, 400, "CAMPO_OBRIGATORIO", "O nome do medicamento é obrigatório.");
            return;
        }

        String tipo = body.has("tipo") ? body.get("tipo").getAsString() : "Oral";
        String indicacao = body.has("indicacao") ? body.get("indicacao").getAsString() : "Terapêutica clínica animal";
        String posologia = body.has("posologia") ? body.get("posologia").getAsString() : "Conforme prescrição médica";
        String veterinario = body.has("veterinario") ? body.get("veterinario").getAsString() : "Dr. Ricardo Mendonça (CRMV-SP 38.412)";
        String status = body.has("status") ? body.get("status").getAsString() : "Ativo";

        try {
            Prescricao novaRx = new Prescricao();
            novaRx.setNome(nome.trim());
            novaRx.setTipo(tipo.trim());
            novaRx.setIndicacao(indicacao.trim());
            novaRx.setPosologia(posologia.trim());
            novaRx.setVeterinario(veterinario.trim());
            novaRx.setStatus(status.trim());

            Prescricao salva = prontuarioService.adicionarPrescricao(petId, novaRx);

            JsonObject resp = new JsonObject();
            resp.addProperty("sucesso", true);
            resp.addProperty("mensagem", "Prescrição médica cadastrada com sucesso.");
            resp.add("prescricao", HttpHelper.getGson().toJsonTree(salva));

            HttpHelper.enviarJson(exchange, 201, resp);

        } catch (Exception e) {
            System.err.println("[PrescricaoPostHandler] Erro ao cadastrar prescrição: " + e.getMessage());
            HttpHelper.enviarErro(exchange, 500, "ERRO_GRAVACAO", "Falha ao gravar prescrição: " + e.getMessage());
        }
    }
}
