package br.com.petstory.server;

import br.com.petstory.service.ProntuarioService;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;

/**
 * ============================================================================
 * HANDLER HTTP: ProntuarioHandler (GET /api/pets/{id}/prontuario)
 * ============================================================================
 * Retorna o prontuário completo e seguro do pet especificado por Tag PST, Microchip ou UUID.
 */
public class ProntuarioHandler implements HttpHandler {

    private final ProntuarioService prontuarioService;

    public ProntuarioHandler(ProntuarioService prontuarioService) {
        this.prontuarioService = prontuarioService;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (HttpHelper.tratarCors(exchange)) {
            return;
        }

        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            HttpHelper.enviarErro(exchange, 405, "METODO_NAO_PERMITIDO", "Apenas método GET é aceito neste endpoint.");
            return;
        }

        String path = exchange.getRequestURI().getPath();
        // Path esperado: /api/pets/{id}/prontuario ou /api/pets/{id}
        String[] partes = path.split("/");
        // Partes: ["", "api", "pets", "{id}", ...]
        String idOuTag = null;
        if (partes.length >= 4 && !partes[3].trim().isEmpty()) {
            idOuTag = partes[3].trim();
        }

        if (idOuTag == null) {
            HttpHelper.enviarErro(exchange, 400, "PARAMETRO_INVALIDO", "O identificador do pet (Tag PST ou UUID) é obrigatório na URL.");
            return;
        }

        try {
            JsonObject prontuario = prontuarioService.obterProntuarioCompleto(idOuTag);
            HttpHelper.enviarJson(exchange, 200, prontuario);
        } catch (Exception e) {
            System.err.println("[ProntuarioHandler] Erro ao carregar prontuário: " + e.getMessage());
            e.printStackTrace();
            HttpHelper.enviarErro(exchange, 500, "ERRO_INTERNO", "Falha ao carregar dados do prontuário: " + e.getMessage());
        }
    }
}
