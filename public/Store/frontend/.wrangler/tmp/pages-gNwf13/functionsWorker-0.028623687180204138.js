var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/[[path]].js
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}
__name(getCorsHeaders, "getCorsHeaders");
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...getCorsHeaders()
    }
  });
}
__name(json, "json");
function nowMs() {
  return Date.now();
}
__name(nowMs, "nowMs");
var _tokenCache = /* @__PURE__ */ new Map();
async function verifyFirebaseToken(idToken, env) {
  if (!idToken) return null;
  const now = Date.now();
  const cached = _tokenCache.get(idToken);
  if (cached && cached.exp > now) return cached.user;
  if (_tokenCache.size > 100) {
    for (const [k, v] of _tokenCache.entries()) {
      if (v.exp <= now) _tokenCache.delete(k);
    }
  }
  const url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken);
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    return null;
  }
  if (!res.ok) return null;
  let info;
  try {
    info = await res.json();
  } catch (e) {
    return null;
  }
  if (!info || !info.email) return null;
  if (String(info.email_verified) !== "true" && info.email_verified !== true) return null;
  if (info.exp && Number(info.exp) * 1e3 < now) return null;
  const expectedAud = env && env.GOOGLE_CLIENT_ID || "326468727847-v2fpjo7880ugd32lnq6p1rsc3e4dfv6l.apps.googleusercontent.com";
  const aud = Array.isArray(info.aud) ? info.aud[0] : info.aud;
  if (aud !== expectedAud) return null;
  const adminEmail = env && env.ADMIN_EMAIL || "teesoftwareai@gmail.com";
  const user = { email: info.email, name: info.name || info.email, role: info.email === adminEmail ? "admin" : "user" };
  const expMs = info.exp ? Number(info.exp) * 1e3 : now + 5 * 60 * 1e3;
  _tokenCache.set(idToken, { user, exp: Math.min(expMs, now + 5 * 60 * 1e3) });
  return user;
}
__name(verifyFirebaseToken, "verifyFirebaseToken");
function isAdminUser(authUser) {
  return authUser && authUser.role === "admin";
}
__name(isAdminUser, "isAdminUser");
async function listProducts(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, price, created_at as createdAt, updated_at as updatedAt FROM products ORDER BY name"
  ).all();
  return results;
}
__name(listProducts, "listProducts");
async function createProduct(env, body) {
  const name = body && body.name ? String(body.name).trim() : "";
  const price = Number(body && body.price);
  if (!name) return json({ error: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32" }, 400);
  if (isNaN(price) || price < 0) return json({ error: "\u0E23\u0E32\u0E04\u0E32\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" }, 400);
  const now = nowMs();
  const res = await env.DB.prepare(
    "INSERT INTO products (name, price, created_at, updated_at) VALUES (?, ?, ?, ?)"
  ).bind(name, price, now, now).run();
  return json({ id: res.meta.last_row_id, name, price, createdAt: now, updatedAt: now }, 201);
}
__name(createProduct, "createProduct");
async function updateProduct(env, id, body) {
  const existing = await env.DB.prepare(
    "SELECT id, name, price, created_at as createdAt FROM products WHERE id = ?"
  ).bind(id).first();
  if (!existing) return json({ error: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32" }, 404);
  const name = body && body.name ? String(body.name).trim() : existing.name;
  let price = existing.price;
  if (body && body.price !== void 0 && body.price !== null && body.price !== "") {
    price = Number(body.price);
    if (isNaN(price) || price < 0) return json({ error: "\u0E23\u0E32\u0E04\u0E32\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" }, 400);
  }
  const now = nowMs();
  await env.DB.prepare(
    "UPDATE products SET name = ?, price = ?, updated_at = ? WHERE id = ?"
  ).bind(name, price, now, id).run();
  return json({ id: Number(id), name, price, createdAt: existing.createdAt, updatedAt: now });
}
__name(updateProduct, "updateProduct");
async function deleteProduct(env, id) {
  const existing = await env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32" }, 404);
  await env.DB.prepare("DELETE FROM stock_movements WHERE product_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  return json({ success: true });
}
__name(deleteProduct, "deleteProduct");
async function listMovements(env) {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.type, m.product_id as productId, m.quantity, m.price, m.note, m.created_at as createdAt,
            p.name as productName
     FROM stock_movements m
     JOIN products p ON p.id = m.product_id
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT 2000`
  ).all();
  return results;
}
__name(listMovements, "listMovements");
async function addMovement(env, body) {
  const type = body && body.type === "out" ? "out" : body && body.type === "in" ? "in" : "";
  const productId = Number(body && body.productId);
  const quantity = Number(body && body.quantity);
  const note = body && body.note ? String(body.note).trim() : "";
  const hasPrice = body && body.price !== void 0 && body.price !== null && body.price !== "";
  const price = hasPrice ? Number(body.price) : NaN;
  if (type !== "in" && type !== "out") return json({ error: "\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" }, 400);
  if (!productId) return json({ error: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32" }, 400);
  if (!Number.isInteger(quantity) || quantity <= 0) return json({ error: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E15\u0E47\u0E21\u0E17\u0E35\u0E48\u0E21\u0E32\u0E01\u0E01\u0E27\u0E48\u0E32 0" }, 400);
  if (hasPrice && (isNaN(price) || price < 0)) return json({ error: "\u0E23\u0E32\u0E04\u0E32\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" }, 400);
  const product = await env.DB.prepare("SELECT id, name, price FROM products WHERE id = ?").bind(productId).first();
  if (!product) return json({ error: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32" }, 404);
  const finalPrice = hasPrice ? price : Number(product.price);
  const now = nowMs();
  const res = await env.DB.prepare(
    "INSERT INTO stock_movements (type, product_id, quantity, price, note, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(type, productId, quantity, finalPrice, note, now).run();
  return json({
    success: true,
    id: res.meta.last_row_id,
    type,
    productId,
    quantity,
    price: finalPrice,
    note,
    createdAt: now
  }, 201);
}
__name(addMovement, "addMovement");
async function removeMovement(env, id) {
  const existing = await env.DB.prepare("SELECT id FROM stock_movements WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23" }, 404);
  await env.DB.prepare("DELETE FROM stock_movements WHERE id = ?").bind(id).run();
  return json({ success: true });
}
__name(removeMovement, "removeMovement");
async function getBalance(env) {
  const products = await listProducts(env);
  const movements = await listMovements(env);
  const map = {};
  products.forEach((p) => {
    map[String(p.id)] = { totalIn: 0, totalOut: 0, balance: 0 };
  });
  movements.forEach((m) => {
    const key = String(m.productId);
    if (!map[key]) map[key] = { totalIn: 0, totalOut: 0, balance: 0 };
    if (m.type === "in") map[key].totalIn += m.quantity;
    else if (m.type === "out") map[key].totalOut += m.quantity;
  });
  return products.map((p) => {
    const s = map[String(p.id)];
    s.balance = s.totalIn - s.totalOut;
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      totalIn: s.totalIn,
      totalOut: s.totalOut,
      balance: s.balance,
      balanceValue: s.balance * Number(p.price)
    };
  });
}
__name(getBalance, "getBalance");
async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders() });
  }
  let body = null;
  if (method === "POST" || method === "PUT") {
    const ct = request.headers.get("Content-Type") || "";
    if (ct.includes("application/json")) {
      try {
        body = await request.json();
      } catch (e) {
        body = {};
      }
    }
  }
  try {
    if (url.pathname === "/api/auth" && method === "POST") {
      const pw = (body && body.password || "").toString();
      const expected = env.PASSWORD || "1234";
      if (expected && pw === expected) return json({ success: true, token: expected, role: "admin" });
      return json({ error: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" }, 401);
    }
    if (url.pathname === "/api/auth/google" && method === "POST") {
      const idToken = (body && body.idToken || "").toString();
      if (!idToken) return json({ error: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E2A\u0E48\u0E07 idToken" }, 400);
      const authUser2 = await verifyFirebaseToken(idToken, env);
      if (!authUser2) return json({ error: "Google verify \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 - token \u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38" }, 401);
      return json({ success: true, token: idToken, email: authUser2.email, name: authUser2.name, role: authUser2.role });
    }
    if (url.pathname === "/api/me" && method === "GET") {
      const h = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!h) return json({ error: "Unauthorized" }, 401);
      if (h === (env.PASSWORD || "1234")) return json({ success: true, user: { role: "admin", method: "password" } });
      const u = await verifyFirebaseToken(h, env);
      if (!u) return json({ error: "Unauthorized" }, 401);
      return json({ success: true, user: u });
    }
    const authHeader = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    let authUser = null;
    if (authHeader) {
      if (authHeader === (env.PASSWORD || "1234")) {
        authUser = { role: "admin" };
      } else {
        authUser = await verifyFirebaseToken(authHeader, env);
      }
    }
    if (!authUser) return json({ error: "Unauthorized" }, 401);
    const needsAdmin = method === "POST" || method === "PUT" || method === "DELETE";
    if (needsAdmin && !isAdminUser(authUser)) {
      return json({ error: "\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19" }, 403);
    }
    if (url.pathname === "/api/products" && method === "GET") return json({ products: await listProducts(env) });
    if (url.pathname === "/api/products" && method === "POST") return await createProduct(env, body);
    if (url.pathname === "/api/products" && method === "PUT") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "\u0E44\u0E21\u0E48\u0E1E\u0E1A id" }, 400);
      return await updateProduct(env, id, body);
    }
    if (url.pathname === "/api/products" && method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "\u0E44\u0E21\u0E48\u0E1E\u0E1A id" }, 400);
      return await deleteProduct(env, id);
    }
    if (url.pathname === "/api/movements" && method === "GET") return json({ movements: await listMovements(env) });
    if (url.pathname === "/api/movements" && method === "POST") return await addMovement(env, body);
    if (url.pathname === "/api/movements" && method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "\u0E44\u0E21\u0E48\u0E1E\u0E1A id" }, 400);
      return await removeMovement(env, id);
    }
    if (url.pathname === "/api/balance" && method === "GET") return json({ report: await getBalance(env) });
    return json({ error: "Not Found", path: url.pathname }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: err.message || "Server error" }, 500);
  }
}
__name(onRequest, "onRequest");

// ../.wrangler/tmp/pages-gNwf13/functionsRoutes-0.6231284903774534.mjs
var routes = [
  {
    routePath: "/api/:path*",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// ../../../../../../.npm/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
