#!/usr/bin/env python3
"""
Generador de diagrama ER desde esquema SQLite
Crea una imagen PNG del modelo relacional de la base de datos
"""

import sqlite3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

def extract_schema(db_path):
    """Extrae tablas y relaciones del esquema SQLite"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Obtener todas las tablas
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = cursor.fetchall()
    
    schema = {}
    
    for (table_name,) in tables:
        # Obtener columnas
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        
        # Obtener claves foráneas
        cursor.execute(f"PRAGMA foreign_key_list({table_name})")
        fks = cursor.fetchall()
        
        schema[table_name] = {
            'columns': columns,
            'foreign_keys': fks
        }
    
    conn.close()
    return schema

def generate_dot_with_graphviz(schema, output_path):
    """Genera y convierte DOT a PNG usando la librería graphviz"""
    try:
        import graphviz
        
        dot = graphviz.Digraph('ER', comment='Entity-Relationship Diagram')
        dot.attr(rankdir='LR')
        dot.attr('node', shape='plaintext')
        dot.attr('edge', fontname='Arial', fontsize='9')
        
        # Crear nodos para cada tabla
        for table_name, info in schema.items():
            columns_html = f'<TR><TD PORT="title" BGCOLOR="lightblue"><B>{table_name}</B></TD></TR>'
            
            for col in info['columns']:
                col_id, col_name, col_type, col_notnull, col_default, col_pk = col
                pk_marker = "🔑" if col_pk else " "
                columns_html += f'<TR><TD PORT="{col_name}" ALIGN="LEFT">{pk_marker} {col_name}: {col_type}</TD></TR>'
            
            html_label = f'''<
<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
{columns_html}
</TABLE>>'''
            
            dot.node(table_name, label=html_label)
        
        # Agregar relaciones (foreign keys)
        edges_added = set()
        for table_name, info in schema.items():
            for fk in info['foreign_keys']:
                fk_data = fk[:7]
                fk_id, seq, referenced_table, from_col, to_col, on_delete, on_update = fk_data
                edge_name = f"{table_name}_{from_col}_to_{referenced_table}_{to_col}"
                
                if edge_name not in edges_added:
                    label = f"{from_col}→{to_col}"
                    dot.edge(table_name, referenced_table, label=label, color='darkblue', penwidth='2')
                    edges_added.add(edge_name)
        
        # Generar PNG
        output_file = str(output_path.with_suffix(''))
        dot.render(output_file, format='png', cleanup=True)
        print(f"✓ Imagen PNG generada: {output_path}")
        return output_path
    
    except Exception as e:
        print(f"⚠ Error generando PNG: {e}")
        return None

def generate_dot(schema, output_path):
    """Genera archivo DOT para Graphviz"""
    dot_content = """digraph ERDiagram {
    rankdir=LR;
    splines=ortho;
    nodesep=1;
    
    node [shape=plaintext];
    edge [fontname="Arial" fontsize=9 labeldistance=1.5 penwidth=1.5];
    
"""
    
    # Crear nodos para cada tabla
    for table_name, info in schema.items():
        columns_html = '<TR><TD PORT="title" BGCOLOR="lightblue"><B>' + table_name + '</B></TD></TR>'
        
        for col in info['columns']:
            col_id, col_name, col_type, col_notnull, col_default, col_pk = col
            pk_marker = "🔑 " if col_pk else "  "
            columns_html += f'<TR><TD PORT="{col_name}" ALIGN="LEFT"><B>{pk_marker}</B>{col_name}: {col_type}</TD></TR>'
        
        node_def = f'''{table_name} [label=<
<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
{columns_html}
</TABLE>>];
'''
        dot_content += node_def
    
    # Agregar relaciones (foreign keys)
    dot_content += "\n    // Relaciones\n"
    edges_added = set()
    
    for table_name, info in schema.items():
        for fk in info['foreign_keys']:
            # PRAGMA foreign_key_list retorna: (id, seq, table, from, to, on_delete, on_update, match)
            fk_data = fk[:7]  # Tomar solo los primeros 7 elementos
            fk_id, seq, referenced_table, from_col, to_col, on_delete, on_update = fk_data
            edge_name = f"{table_name}_{from_col}_to_{referenced_table}_{to_col}"
            
            if edge_name not in edges_added:
                dot_content += f'    {table_name} -> {referenced_table} [label="{from_col}→{to_col}" color=darkblue penwidth=2];\n'
                edges_added.add(edge_name)
    
    dot_content += "}\n"
    
    # Guardar archivo DOT
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(dot_content)
    
    print(f"✓ Archivo DOT generado: {output_path}")
    return output_path

def main():
    db_path = Path(__file__).parent / "users.db"
    doc_dir = Path(__file__).parent.parent / "Documentacion"
    
    if not db_path.exists():
        print(f"✗ Base de datos no encontrada: {db_path}")
        return 1
    
    print("📊 Generando diagrama ER desde esquema SQLite...")
    
    # Extraer schema
    schema = extract_schema(db_path)
    print(f"✓ {len(schema)} tablas encontradas")
    
    # Intentar generar PNG con graphviz Python
    doc_dir.mkdir(parents=True, exist_ok=True)
    png_path = generate_dot_with_graphviz(schema, doc_dir / "ESQUEMA_BD.png")
    
    if png_path:
        print(f"\n✅ Diagrama completado: {png_path}")
        print(f"   Tamaño de archivo: {Path(png_path).stat().st_size / 1024:.1f} KB")
        return 0
    else:
        # Fallback: generar DOT
        dot_path = generate_dot(schema, doc_dir / "ESQUEMA_BD.dot")
        print(f"⚠ Conversión a PNG falló. Usa: dot -Tpng {dot_path} -o {dot_path.with_suffix('.png')}")
        return 1

if __name__ == "__main__":
    import sys
    sys.exit(main() or 0)
