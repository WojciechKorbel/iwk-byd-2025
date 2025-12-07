from PIL import Image

def fit_into_square(img: Image.Image, size=300, bg_color="white"):
    square = Image.new("RGB", (size, size), bg_color)

    img_copy = img.copy()
    img_copy.thumbnail((size, size), Image.LANCZOS)

    w, h = img_copy.size
    x = (size - w) // 2
    y = (size - h) // 2

    square.paste(img_copy, (x, y))
    return square

def crop_to_square(img):
    w, h = img.size
    min_side = min(w, h)
    left = (w - min_side) // 2
    top = (h - min_side) // 2
    return img.crop((left, top, left + min_side, top + min_side))

def squeeze_to_square(img: Image.Image, size=300):
    return img.resize((size, size), Image.LANCZOS)

class PhotoLayoutGenerator:
    def create_collage(self, img1, img2, img3, logo, result_path):
        """"
        Tworzy kolarz 2x2 z podanych zdjęć i loga i zapisuje w pliku wynikowym
        """
        imgs = [img1, img2, img3]

        img_sq = [fit_into_square(crop_to_square(el)) for el in imgs]
        img_sq.append(fit_into_square(logo))

        thumb_size = (300, 300)
        for img in img_sq:
            img.thumbnail(thumb_size)

        cols = 2
        rows = 2

        collage_width = cols * thumb_size[0]
        collage_height = rows * thumb_size[1]

        collage = Image.new('RGB', (collage_width, collage_height), color='white')

        i = 0
        for row in range(rows):
            for col in range(cols):
                if i >= len(img_sq):
                    break
                collage.paste(img_sq[i], (col * thumb_size[0], row * thumb_size[1]))
                i += 1

        collage.save(result_path)

    def read_image(self, filepath):
        """
        Czyta obraz
        :param filepath: ścieżka z obrazem do odczytu
        :return: wczytany obraz
        """
        return Image.open(filepath).convert("RGB")


#
# plg = PhotoLayoutGenerator()
#
# bydgoszcz_logo_path = 'photoLayoutImages/bydgoszczLogo.png'
# output_path = 'photoLayoutImages/final_layout.jpg'
#
# img1 = plg.read_image("photoLayoutImages/img003.jpg")
# img2 = plg.read_image("photoLayoutImages/img004.jpg")
# img3 = plg.read_image("photoLayoutImages/img005.jpg")
# bydgoszcz_logo = plg.read_image(bydgoszcz_logo_path)
#
# plg.create_collage(img1, img2, img3, bydgoszcz_logo, output_path)