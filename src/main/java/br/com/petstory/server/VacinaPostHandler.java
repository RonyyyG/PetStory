package br.com.petstory.server;

import br.com.petstory.model.Vacina;
import br.com.petstory.service.ProntuarioService;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

// Endpoint /api/vacinas para registrar novas doses com CRMV e consultar o histórico do pet
public class VacinaPostHandler implements HttpHandler {

    private final ProntuarioService prontuarioService;

    public VacinaPostHandler(ProntuarioService prontuarioService) {
        this.prontuarioService = prontuarioService;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (HttpHelper.tratarCors(exchange)) {
            return;
        }

        String metodo = exchange.getRequestMethod();

        if ("GET".equalsIgnoreCase(metodo)) {
            // Permite listar vacinas passando query param ?petId=... ou ?pet_id=...
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
            List<Vacina> lista = prontuarioService.listarVacinas(petId);
            JsonObject resp = new JsonObject();
            resp.addProperty("sucesso", true);
            resp.add("vacinas", HttpHelper.getGson().toJsonTree(lista));
            HttpHelper.enviarJson(exchange, 200, resp);
            return;
        }

        if (!"POST".equalsIgnoreCase(metodo)) {
            HttpHelper.enviarErro(exchange, 405, "METODO_NAO_PERMITIDO", "Método não permitido. Utilize POST ou GET.");
            return;
        }

        JsonObject body = HttpHelper.lerCorpoJson(exchange);

        // Extrai identificador do pet
        String petId = null;
        if (body.has("petId")) petId = body.get("petId").getAsString();
        else if (body.has("pet_id")) petId = body.get("pet_id").getAsString();
        else if (body.has("tag")) petId = body.get("tag").getAsString();

        // Extrai campos da vacina
        String nome = null;
        if (body.has("nome")) nome = body.get("nome").getAsString();
        else if (body.has("nome_vacina")) nome = body.get("nome_vacina").getAsString();
        else if (body.has("nomeVacina")) nome = body.get("nomeVacina").getAsString();

        if (nome == null || nome.trim().isEmpty()) {
            HttpHelper.enviarErro(exchange, 400, "CAMPO_OBRIGATORIO", "O nome da vacina é obrigatório.");
            return;
        }

        String lote = "Lote Padrão";
        if (body.has("lote")) lote = body.get("lote").getAsString();
        else if (body.has("laboratorio_lote")) lote = body.get("laboratorio_lote").getAsString();
        else if (body.has("loteFabricante")) lote = body.get("loteFabricante").getAsString();

        LocalDate dataApl = LocalDate.now();
        if (body.has("data_aplicacao") && !body.get("data_aplicacao").isJsonNull()) {
            try {
                dataApl = LocalDate.parse(body.get("data_aplicacao").getAsString().substring(0, 10));
            } catch (Exception ignored) {}
        } else if (body.has("dataAplicacao") && !body.get("dataAplicacao").isJsonNull()) {
            try {
                dataApl = LocalDate.parse(body.get("dataAplicacao").getAsString().substring(0, 10));
            } catch (Exception ignored) {}
        }

        LocalDate dataRef = dataApl.plusYears(1);
        if (body.has("data_reforco") && !body.get("data_reforco").isJsonNull()) {
            try {
                dataRef = LocalDate.parse(body.get("data_reforco").getAsString().substring(0, 10));
            } catch (Exception ignored) {}
        } else if (body.has("dataReforco") && !body.get("dataReforco").isJsonNull()) {
            try {
                dataRef = LocalDate.parse(body.get("dataReforco").getAsString().substring(0, 10));
            } catch (Exception ignored) {}
        }

        String crmv = "Médico-Veterinário Habilitado";
        if (body.has("veterinario_crmv")) crmv = body.get("veterinario_crmv").getAsString();
        else if (body.has("veterinarioResponsavel")) crmv = body.get("veterinarioResponsavel").getAsString();
        else if (body.has("crmv")) crmv = body.get("crmv").getAsString();

        try {
            Vacina novaVacina = new Vacina();
            novaVacina.setNomeVacina(nome.trim());
            novaVacina.setLoteFabricante(lote.trim());
            novaVacina.setDataAplicacao(dataApl);
            novaVacina.setDataReforco(dataRef);
            novaVacina.setVeterinarioResponsavel(crmv.trim());

            Vacina salva = prontuarioService.adicionarVacina(petId, novaVacina);

            JsonObject resp = new JsonObject();
            resp.addProperty("sucesso", true);
            resp.addProperty("mensagem", "Vacina cadastrada e assinada eletronicamente com sucesso.");
            resp.add("vacina", HttpHelper.getGson().toJsonTree(salva));

            HttpHelper.enviarJson(exchange, 201, resp);

        } catch (Exception e) {
            System.err.println("[VacinaPostHandler] Erro ao cadastrar vacina: " + e.getMessage());
            HttpHelper.enviarErro(exchange, 500, "ERRO_GRAVACAO", "Falha ao gravar vacina: " + e.getMessage());
        }
    }
}
