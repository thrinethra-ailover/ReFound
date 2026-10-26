# Open English Wordnet attribution

ReFound includes a generated subset of Open English Wordnet 2025's single-word
synonym synsets for physical descriptions, objects, materials, shapes, and
locations. This is adapted data, normalized and filtered for ReFound's
ownership-verification comparisons.

**Source:** Open English Wordnet 2025, Open English Wordnet Community,
https://en-word.net/ and https://github.com/globalwordnet/english-wordnet.

**License:** Creative Commons Attribution 4.0 International (CC BY 4.0),
https://creativecommons.org/licenses/by/4.0/.

The source is derived from Princeton WordNet. Princeton WordNet data is
copyright © 2006 Princeton University and provided under the WordNet license:
https://wordnet.princeton.edu/license-and-commercial-use. The data is provided
without warranties. The names Princeton University and Princeton are not used
to endorse ReFound.

The generated files are `supabase/migrations/0018_open_english_wordnet.sql`
and `src/lib/matching/openEnglishWordnetSynsets.ts`. Recreate them from the
official release with `python scripts/build_oewn_lexicon.py`; the script
downloads the source archive if it is not already present in the project root.
