package br.com.petstory.server;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.time.LocalDateTime;

/**
 * Endpoint de monitoramento: GET /api/health
 */
public class HealthHandler implements HttpHandler {

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (HttpHelper.tratarCors(exchange)) {
            return;
        }

        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            HttpHelper.enviarErro(exchange, 405, "Método não permitido", "Utilize GET para /api/health");
            return;
        }

        JsonObject response = new JsonObject();
        response.addProperty("status", "OK");
        response.addProperty("service", "PetStory Backend Server");
        response.addProperty("version", "1.0.0");
        response.addProperty("javaVersion", System.getProperty("java.version"));
        response.addProperty("timestamp", LocalDateTime.now().toString());

        HttpHelper.enviarJson(exchange, 200, response);
    }
}
