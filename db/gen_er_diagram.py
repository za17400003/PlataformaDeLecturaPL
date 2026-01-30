#!/usr/bin/env python3
"""
Generador de diagrama ER (Entidad-Relación) desde SQLite
Genera una imagen PNG del esquema de base de datos
"""

import sqlite3
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# Colores
COLOR_BG = (255, 255, 255)
COLOR_TABLE = (230, 240, 255)
COLOR_BORDER = (0, 0, 139)
COLOR_TEXT = (0, 0, 0)
COLOR_KEY = (200, 0, 0)  # Rojo para claves primarias
COLOR_FK = (0, 100, 200)  # Azul para claves foráneas
COLOR_LINE = (100, 100, 100)

class ERDiagram:
    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.tables = {}
        self.relationships = []
        self.load_schema()
    
    def load_schema(self):
        """Carga el esquema de la base de datos"""
        cursor = self.conn.cursor()
        
        # Obtener todas las tablas
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        table_names = [row[0] for row in cursor.fetchall()]
        
        for table_name in table_names:
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = cursor.fetchall()
            
            cursor.execute(f"PRAGMA foreign_key_list({table_name})")
            fks = cursor.fetchall()
            
            self.tables[table_name] = {
                'columns': columns,
                'foreign_keys': fks
            }
            
            # Registrar relaciones
            for fk in fks:
                self.relationships.append({
                    'from_table': table_name,
                    'from_col': fk[3],
                    'to_table': fk[2],
                    'to_col': fk[4]
                })
    
    def _get_table_width(self, table_name):
        """Calcula el ancho dinámico de una tabla basado en contenido"""
        # Ancho mínimo
        min_width = 200
        
        # Ancho del nombre de tabla
        name_width = len(table_name) * 8 + 30
        
        # Ancho del campo más largo
        max_field_width = 0
        for col in self.tables[table_name]['columns']:
            col_name = col[1]
            col_type = col[2]
            field_text = f"🔑 {col_name}: {col_type}"
            field_width = len(field_text) * 7 + 30
            max_field_width = max(max_field_width, field_width)
        
        return max(min_width, max(name_width, max_field_width))
    
    def _get_table_height(self, table_name):
        """Calcula la altura real de una tabla específica"""
        base_height = 85
        row_height = 26
        num_cols = len(self.tables[table_name]['columns'])
        return base_height + num_cols * row_height
    
    def generate_image(self, output_path):
        """Genera la imagen PNG del diagrama con tamaño automático"""
        # Calcular dimensiones dinámicamente
        
        # Configurar grid: 2 columnas si hay pocas tablas, 3 si hay más
        num_tables = len(self.tables)
        cols = 2 if num_tables <= 4 else (3 if num_tables <= 9 else 4)
        rows = (num_tables + cols - 1) // cols
        
        # Calcular tabla heights y widths para cada tabla
        sorted_tables = sorted(self.tables.keys())
        table_heights = {t: self._get_table_height(t) for t in sorted_tables}
        table_widths = {t: self._get_table_width(t) for t in sorted_tables}
        
        # Calcular altura y ancho por fila/columna (máximos en esa fila/columna)
        row_heights = [0] * rows
        col_widths = [0] * cols
        for i, table_name in enumerate(sorted_tables):
            row = i // cols
            col = i % cols
            row_heights[row] = max(row_heights[row], table_heights[table_name])
            col_widths[col] = max(col_widths[col], table_widths[table_name])
        
        # Espacios
        margin = 10
        h_spacing = 100  # Espacio horizontal entre tablas
        v_spacing = 80   # Espacio vertical entre tablas
        
        # Calcular dimensiones finales con buffer adicional para margen inferior
        width = sum(col_widths) + (cols - 1) * h_spacing + 2 * margin
        height = sum(row_heights) + (rows - 1) * v_spacing + 2 * margin + 100
        
        # Crear imagen
        img = Image.new('RGB', (int(width), int(height)), COLOR_BG)
        draw = ImageDraw.Draw(img)
        
        # Posiciones de las tablas
        table_positions = self._layout_tables_with_widths_heights(cols, rows, margin, col_widths, h_spacing, v_spacing, row_heights)
        
        # Dibujar relaciones primero (líneas de fondo)
        for rel in self.relationships:
            self._draw_relationship(draw, rel, table_positions)
        
        # Dibujar tablas
        for table_name, pos in table_positions.items():
            self._draw_table(draw, table_name, pos)
        
        img.save(output_path)
        print(f"✓ Diagrama ER generado: {output_path} ({int(width)}x{int(height)}px)")
    
    def _layout_tables_with_widths_heights(self, cols, rows, margin, col_widths, h_spacing, v_spacing, row_heights):
        """Calcula posiciones de las tablas considerando alturas y anchos reales"""
        positions = {}
        sorted_tables = sorted(self.tables.keys())
        
        # Calcular espacios de inicio para cada columna y fila
        x_positions = [margin]
        for i in range(1, cols):
            x_positions.append(x_positions[-1] + col_widths[i-1] + h_spacing)
        
        y_positions = [margin]
        for i in range(1, rows):
            y_positions.append(y_positions[-1] + row_heights[i-1] + v_spacing)
        
        # Posicionar tablas en el centro de su celda
        for i, table_name in enumerate(sorted_tables):
            row = i // cols
            col = i % cols
            # Centro de la celda
            x = x_positions[col] + col_widths[col] / 2
            y = y_positions[row] + row_heights[row] / 2
            positions[table_name] = (x, y)
        
        return positions
    
    def _draw_table(self, draw, table_name, pos):
        """Dibuja una tabla en el diagrama"""
        x, y = pos
        table_width = self._get_table_width(table_name)
        table_height = 85 + len(self.tables[table_name]['columns']) * 26
        
        # Fondo de tabla
        draw.rectangle(
            [(x - table_width//2, y - 20), (x + table_width//2, y - 20 + table_height)],
            fill=COLOR_TABLE,
            outline=COLOR_BORDER,
            width=2
        )
        
        # Nombre de tabla
        draw.text(
            (x - table_width//2 + 10, y - 15),
            table_name,
            fill=COLOR_BORDER,
            font=None
        )
        
        # Línea separadora
        draw.line(
            [(x - table_width//2, y + 15), (x + table_width//2, y + 15)],
            fill=COLOR_BORDER,
            width=1
        )
        
        # Columnas
        y_offset = y + 20
        for col in self.tables[table_name]['columns']:
            col_name = col[1]
            col_type = col[2]
            is_pk = col[5] > 0
            is_fk = any(fk[3] == col_name for fk in self.tables[table_name]['foreign_keys'])
            
            # Indicador de llave
            marker = "[PK] " if is_pk else ("[FK] " if is_fk else "     ")
            
            text = f"{marker}{col_name}: {col_type}"
            color = COLOR_KEY if is_pk else (COLOR_FK if is_fk else COLOR_TEXT)
            
            draw.text((x - table_width//2 + 12, y_offset), text, fill=color, font=None)
            y_offset += 26
    
    def _draw_relationship(self, draw, rel, positions):
        """Dibuja una relación entre tablas"""
        from_table = rel['from_table']
        to_table = rel['to_table']
        
        if from_table not in positions or to_table not in positions:
            return
        
        x1, y1 = positions[from_table]
        x2, y2 = positions[to_table]
        
        # Línea de relación
        draw.line([(x1, y1), (x2, y2)], fill=COLOR_LINE, width=1)
        
        # Pequeño círculo en el punto de origen
        r = 4
        draw.ellipse([(x1-r, y1-r), (x1+r, y1+r)], fill=COLOR_FK, outline=COLOR_BORDER)

def main():
    db_path = Path(__file__).parent / 'users.db'
    
    if not db_path.exists():
        print(f"Error: No se encontró la base de datos en {db_path}")
        sys.exit(1)
    
    output_path = Path(__file__).parent / 'ESQUEMA_ER.png'
    
    print(f"Generando diagrama ER desde: {db_path}")
    
    diagram = ERDiagram(str(db_path))
    diagram.generate_image(str(output_path))
    
    print(f"✓ Imagen guardada en: {output_path}")

if __name__ == '__main__':
    main()
