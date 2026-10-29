import unittest

from second_algorithm.chapters import _practice_prose, _prose_outline


class ManagedPracticeStructureTests(unittest.TestCase):
    def section(self, body, types=None):
        text = '<a id="one"></a>\n## One\n' + body + '\n<a id="two"></a>\n## Two\n'
        document = {"draft": text, "subheadingTypes": types or {"work": "hcode", "practice": "practice"}}
        outline = _prose_outline(text)
        errors = []
        result = _practice_prose(document, outline, outline["locations"]["one"],
                                 outline["locations"]["two"]["line"], "one", errors)
        return result, errors

    def test_exercise_links_belong_to_practice_not_implementation(self):
        text, errors = self.section('<a id="work"></a>\n### Implementation\n[Not a practice](https://example.com/outside)\n'
                                    '<a id="practice"></a>\n### Exercises\n[Task](https://example.com/task)\n')
        self.assertFalse(errors)
        self.assertIn("https://example.com/task", text)
        self.assertNotIn("https://example.com/outside", text)

    def test_plain_label_or_wrong_role_is_not_a_practice_unit(self):
        for body in ['Exercises: [Task](https://example.com/task)\n',
                     '<a id="work"></a>\n### Exercises\n[Task](https://example.com/task)\n']:
            text, errors = self.section(body)
            self.assertTrue(errors)
            self.assertNotIn("https://example.com/task", text)

    def test_practice_cannot_be_nested_under_an_implementation(self):
        _, errors = self.section('<a id="work"></a>\n### Implementation\n'
                                 '<a id="practice"></a>\n#### Exercises\n[Task](https://example.com/task)\n')
        self.assertTrue(errors)

    def test_multiple_real_groups_are_supported_without_borrowing_another_section(self):
        text, errors = self.section('<a id="practice"></a>\n### Standard\n[First](https://example.com/first)\n'
                                    '<a id="more"></a>\n### Variants\n[Second](https://example.com/second)\n',
                                    {"practice": "practice", "more": "practice"})
        self.assertFalse(errors)
        self.assertIn("https://example.com/first", text)
        self.assertIn("https://example.com/second", text)

    def test_practice_span_ends_at_the_next_peer_and_ignores_code_and_comments(self):
        text, errors = self.section('<a id="practice"></a>\n### Exercises\n[Task](https://example.com/task)\n'
                                    '```md\n[Fake](https://example.com/code)\n```\n'
                                    '<!-- [Fake](https://example.com/comment) -->\n'
                                    '<a id="work"></a>\n### Other\n[Outside](https://example.com/after)\n')
        self.assertFalse(errors)
        self.assertIn("https://example.com/task", text)
        for value in ["/code", "/comment", "/after"]:
            self.assertNotIn("https://example.com" + value, text)


if __name__ == "__main__":
    unittest.main()
