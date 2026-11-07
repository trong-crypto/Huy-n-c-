"""Use the canonical documents renderer with a Microsoft Word PDF on Windows.

The document skill's runtime does not bundle LibreOffice for Windows. Word
exports the actual DOCX; only the conversion callback is adapted. The canonical
render_docx.py performs DOCX size detection and PDF-to-PNG rendering with the
bundled Python/Poppler. No installed LibreOffice fallback is used.
"""
from pathlib import Path
import argparse
import importlib.util
import os
import shutil
import sys
import tempfile


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--docx',type=Path,required=True)
    parser.add_argument('--pdf',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    workspace=Path(__file__).resolve().parents[1]
    for path in (args.docx,args.pdf,args.output):
        if not path.resolve().is_relative_to(workspace):raise ValueError('Report render paths must stay inside the workspace')
    render_temp=args.output.resolve().parent/'render-temp'
    render_temp.mkdir(parents=True,exist_ok=True)
    tempfile.tempdir=str(render_temp)
    runtime=Path(r'C:\Users\abc\.cache\codex-runtimes\codex-primary-runtime')
    renderer=runtime/'plugins/openai-primary-runtime/plugins/documents/skills/documents/render_docx.py'
    poppler=runtime/'dependencies/native/poppler/Library/bin'
    os.environ['PATH']=str(poppler)+os.pathsep+os.environ.get('PATH','')
    spec=importlib.util.spec_from_file_location('canonical_docx_renderer',renderer)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    def word_pdf(doc_path,user_profile,convert_tmp_dir,stem,verbose):
        destination=Path(convert_tmp_dir)/(stem+'.pdf')
        shutil.copy2(args.pdf,destination)
        return str(destination),'Actual DOCX exported through hidden Microsoft Word COM; no LibreOffice used.'
    module.convert_to_pdf=word_pdf
    sys.argv=[str(renderer),str(args.docx),'--output_dir',str(args.output),'--dpi','150']
    module.main()


if __name__=='__main__':main()
