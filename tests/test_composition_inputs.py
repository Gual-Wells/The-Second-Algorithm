"""Original author inputs remain in the release identity after chapter assembly."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from second_algorithm.learning import composition_inputs, course_snapshot
from second_algorithm.storage import digest


class CompositionInputsTest(unittest.TestCase):
    def setUp(self):
        self.base = Path(__file__).resolve().parents[1] / '.local' / 'composition-python-tests'
        self.base.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=self.base)
        self.root = Path(self.temp.name).resolve()
        self.doc = dict(id='chapter', title='Example', path='content/unit/chapter',
                        composition='content/unit/chapter.authoring.json')
        self.plan = dict(schemaVersion=1, title='Example',
                         sourceFiles=['content/unit/author.source.md'], codeSources=['content/unit/author.cpp'],
                         prelude=dict(source='content/unit/author.source.md', anchor='prelude'),
                         sections=[dict(id='type', source='content/unit/author.source.md', anchor='type')])
        self.write('tools/compose-chapter.mjs', '// current composer\n')
        self.write('tools/subheadings.mjs', '// current subheading projection\n')
        self.write('content/unit/author.source.md', '<a id="prelude"></a>\n## Theory\n\n<a id="type"></a>\n## Type\n')
        self.write('content/unit/author.cpp', '// unique author code\n')
        self.write('content/unit/chapter.source.md', '# Example\n\n## Theory\n\n## Type\n')
        self.write('content/unit/chapter.cpp', '// generated delivery code\n')
        self.save_plan()
        names = [self.doc['composition'], 'tools/compose-chapter.mjs', 'tools/subheadings.mjs', *self.plan['sourceFiles'], *self.plan['codeSources']]
        self.build = dict(authoringDependencies={n: digest((self.root / n).read_bytes()) for n in names},
                          sourceSha256=digest((self.root / 'content/unit/chapter.source.md').read_bytes()),
                          codeSha256=digest((self.root / 'content/unit/chapter.cpp').read_bytes()))
        self.save_build()

    def tearDown(self):
        self.assertTrue(self.root.is_relative_to(self.base.resolve()))
        self.temp.cleanup()

    def write(self, name, value):
        p = self.root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(value, encoding='utf-8', newline='\n')

    def save_plan(self):
        self.write(self.doc['composition'], json.dumps(self.plan))

    def save_build(self):
        self.write('content/unit/build/chapter.json', json.dumps(self.build))

    def test_exact_author_and_composer_closure(self):
        self.assertEqual(composition_inputs(self.root, self.doc), self.build['authoringDependencies'])
        self.assertEqual(composition_inputs(self.root, dict(path='content/unit/plain')), {})

    def test_original_author_edits_cannot_inherit_old_generated_output(self):
        for name in ['content/unit/author.source.md', 'content/unit/author.cpp', 'tools/compose-chapter.mjs']:
            before = (self.root / name).read_text(encoding='utf-8')
            self.write(name, before + '// changed\n')
            with self.assertRaisesRegex(ValueError, 'author inputs changed'):
                composition_inputs(self.root, self.doc)
            self.write(name, before)

    def test_omitted_or_extra_dependency_is_rejected(self):
        self.build['authoringDependencies'].pop('content/unit/author.cpp')
        self.save_build()
        with self.assertRaisesRegex(ValueError, 'author inputs changed'):
            composition_inputs(self.root, self.doc)

    def test_generated_files_are_not_a_second_authority(self):
        self.write('content/unit/chapter.cpp', '// separately edited generated file\n')
        with self.assertRaisesRegex(ValueError, 'Generated composition authority changed'):
            composition_inputs(self.root, self.doc)
        self.plan['codeSources'] = ['content/unit/chapter.cpp']
        self.save_plan()
        with self.assertRaisesRegex(ValueError, 'cannot also be author sources'):
            composition_inputs(self.root, self.doc)

    def test_path_escape_and_unassigned_source_are_rejected(self):
        self.plan['sourceFiles'] = ['content/../private.source.md']
        self.save_plan()
        with self.assertRaisesRegex(ValueError, 'Invalid composition authority path'):
            composition_inputs(self.root, self.doc)
        self.plan['sourceFiles'] = ['content/unit/author.source.md']
        self.plan['sections'][0]['source'] = 'content/unit/unlisted.source.md'
        self.save_plan()
        with self.assertRaisesRegex(ValueError, 'not in sourceFiles'):
            composition_inputs(self.root, self.doc)

    def test_malformed_build_is_a_validation_error(self):
        self.write('content/unit/build/chapter.json', '[]')
        with self.assertRaisesRegex(ValueError, 'author inputs changed'):
            composition_inputs(self.root, self.doc)

    def test_reader_boundary_implementation_is_bound_to_review_and_release(self):
        self.write('catalog/learning.json', '{}')
        self.write('carrier/publications.json', '{}')
        self.write('tools/reader-boundary.mjs', '// current reader projection\n')
        checked = dict(ok=True, publicationState='active', operation='content-release')
        context = dict(knowledgeDependencies=[], chapters=dict(dependencies=[], reviewPaths=[]),
                       documents={}, model=dict(tasks=[]), dependencies={})
        with patch('second_algorithm.learning._inspect', return_value=(checked, context)):
            before = course_snapshot(self.root, include_reviews=False)
            self.assertIn('tools/reader-boundary.mjs', before['inputs'])
            self.write('tools/reader-boundary.mjs', '// changed projection and detector\n')
            after = course_snapshot(self.root, include_reviews=False)
        self.assertNotEqual(before['inputHash'], after['inputHash'])

    def test_delivered_cpp_view_is_bound_without_becoming_an_author_source(self):
        self.write('catalog/learning.json', '{}')
        self.write('carrier/publications.json', '{}')
        self.write('content/unit/chapter.reader.cpp', 'int value() { return 1; }\n')
        checked = dict(ok=True, publicationState='active', operation='content-release')
        context = dict(knowledgeDependencies=[], chapters=dict(dependencies=[], reviewPaths=[]),
                       documents={'chapter': dict(path='content/unit/chapter')},
                       model=dict(tasks=[]), dependencies={})
        with patch('second_algorithm.learning._inspect', return_value=(checked, context)):
            before = course_snapshot(self.root, include_reviews=False)
            self.assertIn('content/unit/chapter.reader.cpp', before['inputs'])
            self.write('content/unit/chapter.reader.cpp', 'int value() { return 2; }\n')
            after = course_snapshot(self.root, include_reviews=False)
        self.assertNotEqual(before['inputHash'], after['inputHash'])
        self.assertNotIn('content/unit/chapter.reader.cpp', self.plan['codeSources'])


if __name__ == '__main__':
    unittest.main()
