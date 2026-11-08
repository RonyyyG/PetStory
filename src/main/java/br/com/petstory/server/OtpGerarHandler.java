package br.com.petstory.server;

import br.com.petstory.service.OtpService;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;

/**
 * Endpoint: POST /api/otp/gerar
 */
public class OtpGerarHandler implements HttpHandler {

    private final OtpService otpService;

    public OtpGerarHandler(OtpService otpService) {
        this.otpService = otpService;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (HttpHelper.tratarCors(exchange)) {
            return;
        }

        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            HttpHelper.enviarErro(exchange, 405, "Método não permitido", "Utilize POST para /api/otp/gerar");
            return;
        }

        try {
            JsonObject body = HttpHelper.lerCorpoJson(exchange);
            String petId = body.has("petId") ? body.get("petId").getAsString() : null;
            String tag = body.has("tag") ? body.get("tag").getAsString() : null;

            JsonObject resultado = otpService.gerarOtpParaPet(petId, tag);
            HttpHelper.enviarJson(exchange, 200, resultado);
        } catch (IllegalArgumentException e) {
            HttpHelper.enviarErro(exchange, 400, "Dados incompletos", e.getMessage());
        } catch (SecurityException e) {
            HttpHelper.enviarErro(exchange, 403, "Acesso não autorizado", e.getMessage());
        } catch (Exception e) {
            HttpHelper.enviarErro(exchange, 500, "Erro interno do servidor", e.getMessage());
        }
    }
}
