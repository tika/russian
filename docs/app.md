This app will take in a simple CSV of Russian words that come from a specific unit of a language course, this will contain nouns, adjectives and verbs.
An example of the CSV is:

```
"гро́мкий","loud"
"по-друго́му","differently"
"жени́х","groom, fiancé"
"знако́мый","familiar"
"узнава́ть (узнаю́, узнаёт)/узна́ть (узна́ю, узна́ет)","to find out"
"и́скренний","sincere"
"неи́скренний","insincere"
"изменя́ть (изменя́ю, изменя́ет)/измени́ть (изменю́, изме́нишь) (кому́)","to cheat on"
"целова́ть/поцелова́ть (~целу́ю, ~целу́ет)(кого́)","to kiss"
"целова́ться/поцелова́ться (~целу́юсь, ~целу́ется) (с кем)","to kiss (reflexive)"
```

The problem here is that you do not learn how to conjugate these words, nor do you learn the correct way to use them in a sentence as there is no example adjective, noun after the verb. In English, we might say "We cheat on bad boys", but the flash card just says "to cheat on" - this is not particularly helpful. So the main goal of this app is to take in this CSV and output a new CSV in the same format ("", "" for each line) but for verbs, you add an example adjective and noun after the verb (in the correct form).

The way to do this is simple:
- Take each line in the input, you will notice that it's formatted as `"russian","english"`
- Run this through your first LLM call, decide whether the russian is a verb or not
- If it isn't a verb, just continue - do nothing to the line, append it to the output
- If it is a verb:
  - Run this through your second LLM call - in the prompt, there should be a list of allowed adjectives and nouns and the LLM will choose an appropriate adjective and noun to use for each verb
  - The key here is in prompt engineering. The goal is to output either 6 or 12 new lines, each with a conjugated verb and the appropriate adjective and noun. It's important to note that we should use different adjectives and nouns for each conjugation, and make sure to note `(pf)` if perfective and `(impf)` if imperfective. We should use a range of genders of nouns - the exact number of unimportant, but they shouldn't all be the same.
  - Append these lines to the output
- Construct a CSV file with the output

The format of this application is a NextJS application, where there is a simple UI that allows you to upload a CSV file, and then download a new CSV file with the output.
