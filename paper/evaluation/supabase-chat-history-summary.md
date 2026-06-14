# Supabase Chat History Evaluation Summary

Generated from Supabase `conversations` / `messages` on 2026-06-13 (updated with S2-01, S2-10).

## Scope

- Source project: `UniAgent3` (`qmaqplqlnzltdfuhanga`)
- Source tables: `public.conversations`, `public.messages`
- Included cases:
  - `S1-01` through `S1-10`
  - `S2-01` through `S2-10`

## Interpretation

- `protocol_completion`: the UniAgent workflow reached paid execution and returned a final report with x402 transaction hash(es).
- `task_success`: the returned content satisfied the user task at the domain level.
- `provider_quality_issue`: the external agent returned suspicious, low-quality, mismatched, or partially incorrect content, even when the UniAgent protocol path completed.

## Summary

| Group | Found cases | Protocol completion | Task success | Notes |
| --- | ---: | ---: | ---: | --- |
| S1 | 10 | 10/10 | 10/10 | Some provider-quality issues were detected and explained, but final user-facing task output was usable. |
| S2 | 10 | 10/10 | 8/10 | `S2-03` and `S2-07` completed protocol execution but had task-level provider result mismatches. |

## Case Records

| Case | Conversation ID | Protocol completion | Task success | Provider quality issue | Cost | Tx hashes | Notes |
| --- | --- | --- | --- | --- | ---: | --- | --- |
| S1-01 | `8ab97206-f47f-47e4-bb65-1331c6743491` | true | true | no | 0.01 | `0x59a986b6b4e3e0dacc753a9a1fd8e934f644cc1873a3f6eba2423b87d863b85c` | Tokyo hotel search returned 10 hotels and a recommended result. |
| S1-02 | `ef6e99f2-ff4d-4787-bf7b-72f09ff3f954` | true | true | no | 0.01 | `0x90eece1ca503a201305074e048fb14542988f94a285ca201d31ff75ad9fedcfd` | Paris hotel search returned 10 hotels with budget and premium options. |
| S1-03 | `cfa2708d-6815-4035-9c00-411435d0d559` | true | true | no | 0.01 | `0x8672e013195e6ffeb66d4fcdd0a58514122489bc0e6c277e033ac9a083bb6e18` | London business hotel search returned suitable business-class hotels. |
| S1-04 | `277a9c5e-65ca-489f-8841-69aca3154100` | true | true | minor | 0.01 | `0x732691e83a886fa76ce0e5157dea74fd8c8943f103d916fd9b25cc83e1adafd6` | Singapore family hotel search returned 6 Singapore hotels and 4 Johor Bahru hotels; mismatch was explained. |
| S1-05 | `2ccf5e59-a707-4bec-885e-1e34d183ced2` | true | true | no | 0.01 | `0x953cc357e5e0be46e9190f5bc1a1390227dffba343ea30e39d0cd66e410d39df` | Bangkok budget hotel search returned low-price Sukhumvit options. |
| S1-06 | `792d616e-5bad-40ab-8f33-daa7e3a5b8e3` | true | true | minor | 0.01 | `0x17912e1f6c0ac3c82021e9cb12c75254b51f0ce7c93e9f0b52621525b5af936f` | Sydney luxury hotel search returned mostly 4-star/4.5-star hotels rather than clear 5-star luxury properties. |
| S1-07 | `8ecdbc84-86cd-4a30-9fdf-82f0ffdd2855` | true | true | recovered | 0.02 | `0xc2f40ee20aa54dfb2eda446249603ca685f6623aa9b0e998299a9003d6c97e60`; `0xe3a99e5650aea2d5eae7a2e162f5d716ae1c2e4e9b6ffcedb4d7fda36234bb41` | First hotel agent returned Sydney instead of Shinjuku; fallback to LastMinuteRooms returned Shinjuku/Tokyo hotels. |
| S1-08 | `16afb870-a752-4465-983b-da209dd2f365` | true | true | no | 0.01 | `0x41522ced0fee1ee1cefe735015d6f06b4a14869ffbd49988a95ad61c413294d7` | New York hotel search rerun returned 10 valid New York hotels. Earlier contaminated/invalid run is excluded. |
| S1-09 | `8de2b6ab-3790-4399-8a11-fb52f8e2a03a` | true | true | no | 0.01 | `0xe1e6e2f3131ce4dfb844c35c79dfb56037b9c77f9cb77bdc833d11380d0b2141` | Seoul hotel search returned 10 hotels with price range and recommendations. |
| S1-10 | `24c30bdb-2fcc-4f6c-adf8-17a7a6150ed8` | true | true | no | 0.01 | `0x17a67bab9cd52fcc6981414d7e6622bac0f4903844d14633c4d2f81ee8a3f1a3` | Osaka hotel search returned 10 centrally located hotel options. |
| S2-01 | `c7909062-0512-48c8-ade0-6033cd1db158` | true | true | minor | 0.02 | `0x86216d3af66c0378946bb3cac7a42a1064de4addba257324a06c8cd626380686`; `0x8bbafadd8e04d5ae2fe4745d79b1bb1eac4a987fd03d9b21277ff3030074676a` | One-traveler Tokyo-Paris trip (Aug 10–13, 2026) completed after user supplied dates. Flight and Paris hotel results integrated. Flight provider had duplicate listings and unverified airline entry. |
| S2-02 | `ee9185c0-5dc8-44d0-b002-a62af2bb7a16` | true | true | minor | 0.02 | `0x8bf682955fb5799182856029ce7af88345eb039c56d83ada1eba44d8e73d0f40`; `0xe4ed13835ad4f39db78de79acb47daf346429fe27e5d4c5776057b45adb8d1ee` | Tokyo-London business trip completed with flight and hotel results. Flight provider quality concerns were noted. |
| S2-03 | `6288f7e3-c189-4aa5-8ca8-a92af1d2fe5d` | true | false | yes | 0.02 | `0x7972cc342c0b32ed84b2339ae75555c9c2d50d3eb51411d81233826554382eb1`; `0x25362dc6c34e4ee43a5e3f6d640387377b06fb5a8882aa56fc107f039af73352` | Flight and hotel agents executed, but hotel results were for Johor Bahru, Malaysia rather than Singapore proper; mismatch was detected and explained. |
| S2-04 | `bcd88643-49f3-464d-95b3-6457abfb6ba2` | true | true | minor | 0.02 | `0x62ead0d803d1ac63ca6acf4b20897cd3900facb25bcc62153cb4d928daba14a4`; `0x69db91e29be06e410580b7f42aaf69a1cbcce354f447dd2353ab3348c7fc2cc1` | Tokyo-Bangkok budget trip completed after rating-threshold discovery issue was resolved. |
| S2-05 | `8da2b14b-460b-4692-8786-1649f10b29e1` | true | true | minor | 0.02 | `0x6d58ff0eeaf7dfe69bc99ca5be8d0708062a7b98d741cf28ef8ae654138c745e`; `0x9b912085873cb418656075b7f917c669b319b683b59081534f4ffccb34995aa4` | Tokyo-Sydney luxury weekend trip completed with flight and luxury hotel options. |
| S2-06 | `42399d0b-aa0b-46c2-838c-2a3714c4c322` | true | true | minor | 0.02 | `0x0624d304c79031dc25467629b905528fa70ffeb6c3769d814f8cdf7faf95f29d`; `0x3b41e1f4fde5b6d7e99355ef349d6aa107aafe7c07219de8758bf6b1f6f993cb` | Osaka-Seoul trip completed with direct flight and hotel recommendations. |
| S2-07 | `19499d13-3954-4a8c-892a-d0aecdd92181` | true | false | yes | 0.02 | `0xa0f9df2b7430ce24cf48073a363733f63e25d173bd050b928d566d30488868ee`; `0xad751e064e062e2fc6263364e922b3289462e17f8123482727129bdb19736329` | Hotel results were valid for New York, but the flight agent returned Tokyo-London instead of Tokyo-New York. The orchestrator reported the mismatch instead of presenting it as valid. |
| S2-08 | `40e94e8a-821e-4120-a27c-d636c0952989` | true | true | minor | 0.02 | `0xb28045df87f5ad007807e8f50a0581921862a4974d46b6eb5fad6f7439d78da7`; `0x128a0fe4e3c41aabcccde0094a5763c9982a18e4fa9e9166b96e3ac7e22bf2ec` | Tokyo-London two-night trip completed. Minor provider-quality concerns were noted. |
| S2-09 | `02ea39ff-2e12-4a33-96a7-9a3cffee492f` | true | true | minor | 0.02 | `0x98058a5d3f4911a426917b477741959b589d029018a1d5d929c937b7e8c30eba`; `0xa627b218f3a1a56da7da2f19270fed190d55fe9d48df19ec7c71e68a6175b509` | Tokyo-Paris trip for two adults completed with flight and hotel recommendations. |
| S2-10 | `87807ea2-57f4-442a-85fd-422eb8bde6a7` | true | true | minor | 0.02 | `0x60e31b65c79a20c5f7eb081284665b8461a63e5b36c9d7d177b94e4de1860290`; `0x68cfa0a48b2cabcc469393fabacfa173f6d4f8b6b198d552777dac973a35a57e` | Tokyo-Singapore weekend trip (Jul 24–26, 2026) completed with flight and Singapore hotel recommendations. Hotel provider also included Johor Bahru/Malacca properties; mismatch was noted. |

## Raw Conversation Mapping

| Case | Title |
| --- | --- |
| S1-01 | Search for a hotel in Tokyo for 2 adults from July... |
| S1-02 | Find a hotel in Paris for one traveler from August... |
| S1-03 | Search for a business hotel in London for 1 adult ... |
| S1-04 | Find a family-friendly hotel in Singapore for 2 ad... |
| S1-05 | Search for a budget hotel in Bangkok for 2 adults ... |
| S1-06 | Find a luxury hotel in Sydney for 2 adults from No... |
| S1-07 | Search for a hotel near Shinjuku, Tokyo for one tr... |
| S1-08 | Find a hotel in New York for 2 adults from Decembe... |
| S1-09 | Search for a hotel in Seoul for one traveler from ... |
| S1-10 | Find a hotel in Osaka for 2 adults from September ... |
| S2-01 | Plan a three-day trip to Paris from Tokyo for one ... |
| S2-02 | Plan a business trip from Tokyo to London from Sep... |
| S2-03 | Plan a family trip from Tokyo to Singapore from Ju... |
| S2-04 | Plan a budget trip from Tokyo to Bangkok from Octo... |
| S2-05 | Plan a luxury weekend trip from Tokyo to Sydney fr... |
| S2-06 | Plan a short trip from Osaka to Seoul from August ... |
| S2-07 | Plan a conference trip from Tokyo to New York from... |
| S2-08 | Plan a two-night trip from Tokyo to London for one... |
| S2-09 | Plan a trip from Tokyo to Paris for two adults fro... |
| S2-10 | Plan a weekend trip from Tokyo to Singapore for on... |

## Excluded / Invalid Runs

- New York run `87c13971-b227-4a4b-960a-339b97b8b020` was excluded because it appeared to be affected by cross-case history contamination and returned Sydney/November results for a New York/December query. It was later rerun successfully as `S1-08`.
- Anthropic credit-balance errors should be treated as invalid infrastructure runs and repeated, not as UniAgent workflow failures.

## Suggested Paper Metrics

Current completed set (`S1-01`–`S1-10`, `S2-01`–`S2-10`; S3 not yet run):

- Protocol completion:
  - S1: 10/10
  - S2: 10/10
- Task success:
  - S1: 10/10
  - S2: 8/10
- Provider-quality mismatch detected and explained:
  - S1: 2 cases with notable quality/recovery notes (`S1-04`, `S1-07`)
  - S2: 2 task-failure cases detected and explained (`S2-03`, `S2-07`); minor provider-quality notes in `S2-01`, `S2-10`

