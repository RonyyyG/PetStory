package br.com.petstory.server;

import br.com.petstory.model.Cirurgia;
import br.com.petstory.service.ProntuarioService;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.util.List;

/**
 * ============================================================================
 * HANDLER HTTP: CirurgiaPostHandler (POST /api/cirurgias e GET /api/cirurgias)
 * ============================================================================
 * Registra procedimentos cirúrgicos agendados diretamente no backend Java,
 * gerando lembretes automáticos e alertas na tela do tutor.
 */
public class CirurgiaPostHandler implements HttpHandler {

    private final ProntuarioService prontuarioService;

    public CirurgiaPostHandler(ProntuarioService prontuarioService) {
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
            List<Cirurgia> lista = prontuarioService.listarCirurgias(petId);
            JsonObject resp = new JsonObject();
            resp.addProperty("sucesso", true);
            resp.add("cirurgias", HttpHelper.getGson().toJsonTree(lista));
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
            HttpHelper.enviarErro(exchange, 400, "CAMPO_OBRIGATORIO", "O nome do procedimento/cirurgia é obrigatório.");
            return;
        }

        String data = body.has("data") ? body.get("data").getAsString() : null;
        String cirurgiao = body.has("cirurgiao") ? body.get("cirurgiao").getAsString() : "Dr. Ricardo Mendonça (CRMV-SP 38.412)";
        String notas = body.has("notas") ? body.get("notas").getAsString() : "Jejum obrigatório de 8 horas e exames pré-operatórios.";
        String status = body.has("status") ? body.get("status").getAsString() : "Agendada";

        try {
            Cirurgia novaCirurgia = new Cirurgia();
            novaCirurgia.setNome(nome.trim());
            novaCirurgia.setData(data != null ? data.trim() : "15/11/2026");
            novaCirurgia.setCirurgiao(cirurgiao.trim());
            novaCirurgia.setNotas(notas.trim());
            novaCirurgia.setStatus(status.trim());

            Cirurgia salva = prontuarioService.adicionarCirurgia(petId, novaCirurgia);

            JsonObject resp = new JsonObject();
            resp.addProperty("sucesso", true);
            resp.addProperty("mensagem", "Procedimento cirúrgico agendado com sucesso.");
            resp.add("cirurgia", HttpHelper.getGson().toJsonTree(salva));

            HttpHelper.enviarJson(exchange, 201, resp);

        } catch (Exception e) {
            System.err.println("[CirurgiaPostHandler] Erro ao cadastrar cirurgia: " + e.getMessage());
            HttpHelper.enviarErro(exchange, 500, "ERRO_GRAVACAO", "Falha ao gravar cirurgia: " + e.getMessage());
        }
    }
}
