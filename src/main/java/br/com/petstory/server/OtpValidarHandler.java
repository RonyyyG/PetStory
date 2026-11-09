package br.com.petstory.server;

import br.com.petstory.service.OtpService;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;

/**
 * Endpoint: POST /api/otp/validar
 */
public class OtpValidarHandler implements HttpHandler {

    private final OtpService otpService;

    public OtpValidarHandler(OtpService otpService) {
        this.otpService = otpService;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (HttpHelper.tratarCors(exchange)) {
            return;
        }

        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            HttpHelper.enviarErro(exchange, 405, "Método não permitido", "Utilize POST para /api/otp/validar");
            return;
        }

        try {
            JsonObject body = HttpHelper.lerCorpoJson(exchange);
            String tag = body.has("tag") ? body.get("tag").getAsString() : null;
            String codigoOtp = body.has("codigoOtp") ? body.get("codigoOtp").getAsString() : null;
            String crmv = body.has("crmv") ? body.get("crmv").getAsString() : "CRMV Ativo";

            JsonObject resultado = otpService.validarOtpParaAtendimento(tag, codigoOtp, crmv);
            HttpHelper.enviarJson(exchange, 200, resultado);
        } catch (IllegalArgumentException e) {
            HttpHelper.enviarErro(exchange, 400, "Dados inválidos", e.getMessage());
        } catch (SecurityException e) {
            HttpHelper.enviarErro(exchange, 401, "Acesso recusado", e.getMessage());
        } catch (Exception e) {
            HttpHelper.enviarErro(exchange, 500, "Erro interno do servidor", e.getMessage());
        }
    }
}
