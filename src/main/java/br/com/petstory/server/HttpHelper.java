package br.com.petstory.server;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonDeserializer;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;
import com.google.gson.JsonSerializer;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Utilitários para o Servidor HTTP: CORS, Leitura e Envio de JSON.
 */
public class HttpHelper {

    private static final Gson GSON = new GsonBuilder()
            .registerTypeAdapter(LocalDate.class, (JsonSerializer<LocalDate>) (src, typeOfSrc, context) ->
                    src != null ? new JsonPrimitive(src.toString()) : null)
            .registerTypeAdapter(LocalDate.class, (JsonDeserializer<LocalDate>) (json, typeOfT, context) -> {
                if (json == null || json.getAsString().trim().isEmpty()) return null;
                String val = json.getAsString().trim();
                if (val.contains("T")) val = val.substring(0, val.indexOf("T"));
                return LocalDate.parse(val.substring(0, Math.min(10, val.length())));
            })
            .registerTypeAdapter(LocalDateTime.class, (JsonSerializer<LocalDateTime>) (src, typeOfSrc, context) ->
                    src != null ? new JsonPrimitive(src.toString()) : null)
            .registerTypeAdapter(LocalDateTime.class, (JsonDeserializer<LocalDateTime>) (json, typeOfT, context) -> {
                if (json == null || json.getAsString().trim().isEmpty()) return null;
                return LocalDateTime.parse(json.getAsString().trim(), DateTimeFormatter.ISO_DATE_TIME);
            })
            .serializeNulls()
            .create();

    public static Gson getGson() {
        return GSON;
    }

    /**
     * Aplica os cabeçalhos de CORS e responde requisições OPTIONS (pre-flight).
     * Retorna true se a requisição era OPTIONS e já foi finalizada; false caso contrário.
     */
    public static boolean tratarCors(HttpExchange exchange) throws IOException {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey, X-Requested-With");
        exchange.getResponseHeaders().set("Access-Control-Max-Age", "86400");

        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
            return true;
        }
        return false;
    }

    /**
     * Lê o corpo JSON da requisição.
     */
    public static JsonObject lerCorpoJson(HttpExchange exchange) {
        try (InputStream is = exchange.getRequestBody()) {
            byte[] bytes = is.readAllBytes();
            if (bytes.length == 0) {
                return new JsonObject();
            }
            String jsonStr = new String(bytes, StandardCharsets.UTF_8);
            return JsonParser.parseString(jsonStr).getAsJsonObject();
        } catch (Exception e) {
            return new JsonObject();
        }
    }

    /**
     * Envia uma resposta JSON com o status HTTP especificado.
     * Trata desconexões antecipadas de clientes (WSAECONNABORTED / broken pipe) de forma limpa.
     */
    public static void enviarJson(HttpExchange exchange, int statusCode, Object data) throws IOException {
        try {
            String jsonResposta = GSON.toJson(data);
            byte[] bytes = jsonResposta.getBytes(StandardCharsets.UTF_8);

            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
            exchange.sendResponseHeaders(statusCode, bytes.length);

            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
                os.flush();
            }
        } catch (IOException e) {
            String msg = e.getMessage() != null ? e.getMessage().toLowerCase() : "";
            if (msg.contains("broken pipe") || msg.contains("connection reset") 
                    || msg.contains("wsaeconnaborted") || msg.contains("aborted") 
                    || msg.contains("closed") || msg.contains("socket")) {
                // Navegador ou cliente encerrou a conexão antes do término da resposta (recarregou ou fechou a aba)
                System.out.println("[HttpHelper] Info: Conexão encerrada pelo cliente durante envio: " + e.getMessage());
            } else {
                throw e;
            }
        }
    }

    /**
     * Envia resposta de erro formatada em JSON.
     */
    public static void enviarErro(HttpExchange exchange, int statusCode, String erro, String mensagem) throws IOException {
        JsonObject errObj = new JsonObject();
        errObj.addProperty("sucesso", false);
        errObj.addProperty("erro", erro);
        errObj.addProperty("mensagem", mensagem);
        enviarJson(exchange, statusCode, errObj);
    }
}
