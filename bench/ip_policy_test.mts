// ip_policy_test.mts — lib/safe-fetch.ts privateIp(): every spelling of a local/reserved address is refused, public
// unicast passes. Offline. Run: node bench/ip_policy_test.mts
import { dirname, join } from "node:path"; import { fileURLToPath } from "node:url";
const { privateIp } = await import(join(dirname(fileURLToPath(import.meta.url)), "..", "web", "lib", "safe-fetch.ts"));
const refuse = ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.5", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "192.0.2.1",
  "::", "::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "0:0:0:0:0:ffff:7f00:0001", "[::ffff:7f00:1]", "::127.0.0.1", "::7f00:1",
  "64:ff9b::7f00:1", "64:ff9b::1.2.3.4", "2002:7f00:1::", "2001:0:4136:e378::1", "2001:db8::1", "fc00::1", "fd12:3456::1", "fe80::1%eth0",
  "fec0::1", "ff02::1", "1::", "garbage"];
const allow = ["8.8.8.8", "1.1.1.1", "151.101.1.69", "2606:4700:4700::1111", "2a00:1450:4001:80b::200e", "::ffff:8.8.8.8", "2001:4860:4860::8888"];
const bad = [...refuse.filter((ip) => !privateIp(ip)).map((ip) => `NOT refused: ${ip}`), ...allow.filter((ip) => privateIp(ip)).map((ip) => `wrongly refused: ${ip}`)];
console.log(JSON.stringify({ refused: refuse.length, allowed: allow.length, problems: bad }));
process.exit(bad.length ? 1 : 0);
